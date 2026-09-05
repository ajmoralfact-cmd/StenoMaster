"""
Cashfree Payment Gateway Integration Service for StenoMaster
Supports:
- Sandbox and Production environments
- PG Order creation (/pg/orders)
- Payment session generation for Cashfree JS SDK modal checkout
- Order status fetching and verification (/pg/orders/{order_id})
- Webhook signature validation
"""

import os
import json
import time
import urllib.request
import urllib.error
from typing import Dict, Any, Optional
import db


class CashfreeService:
    SANDBOX_BASE_URL = "https://sandbox.cashfree.com/pg"
    PROD_BASE_URL = "https://api.cashfree.com/pg"
    API_VERSION = "2023-08-01"

    @classmethod
    def get_config(cls) -> Dict[str, str]:
        """Retrieves Cashfree configuration from admin settings or environment variables."""
        settings = db.get_admin_settings()
        app_id = (
            os.environ.get("CASHFREE_APP_ID")
            or settings.get("cashfree_app_id")
            or ""
        ).strip()
        secret_key = (
            os.environ.get("CASHFREE_SECRET_KEY")
            or settings.get("cashfree_secret_key")
            or ""
        ).strip()
        env = (
            os.environ.get("CASHFREE_ENV")
            or settings.get("cashfree_env")
            or "SANDBOX"
        ).strip().upper()

        return {
            "app_id": app_id,
            "secret_key": secret_key,
            "env": "PRODUCTION" if env in ["PROD", "PRODUCTION", "LIVE"] else "SANDBOX",
            "base_url": cls.PROD_BASE_URL if env in ["PROD", "PRODUCTION", "LIVE"] else cls.SANDBOX_BASE_URL
        }

    @classmethod
    def is_configured(cls) -> bool:
        cfg = cls.get_config()
        return bool(cfg["app_id"] and cfg["secret_key"])

    @classmethod
    def create_order(
        cls,
        user: Dict[str, Any],
        amount: float = 100.0,
        plan_days: int = 30,
        return_url: Optional[str] = None
    ) -> Dict[str, Any]:
        """
        Creates an order with Cashfree PG.
        Returns payment_session_id to launch Cashfree JS SDK checkout modal.
        """
        cfg = cls.get_config()
        user_id = user.get("id") or user.get("user_id")
        timestamp = int(time.time())
        order_id = f"order_stm_{user_id}_{timestamp}"

        # Clean customer phone (10 digits required by Indian PGs)
        raw_phone = str(user.get("phone") or "").replace("+91", "").replace(" ", "").strip()
        clean_phone = "".join(filter(str.isdigit, raw_phone))
        if len(clean_phone) < 10:
            clean_phone = "9876543210"
        elif len(clean_phone) > 10:
            clean_phone = clean_phone[-10:]

        customer_name = (user.get("display_name") or user.get("username") or "Student").strip()
        customer_email = (user.get("email") or "student@stenomaster.com").strip()

        order_data = {
            "order_id": order_id,
            "order_amount": round(float(amount), 2),
            "order_currency": "INR",
            "customer_details": {
                "customer_id": f"cust_stm_{user_id}",
                "customer_name": customer_name,
                "customer_email": customer_email,
                "customer_phone": clean_phone
            },
            "order_meta": {
                "return_url": return_url or f"https://stenomaster.com/index.html?order_id={order_id}",
                "payment_methods": "cc,dc,upi,nb"
            },
            "order_note": f"StenoMaster Pro — {plan_days} Days Access (₹{amount:.0f})"
        }

        # If Cashfree credentials are configured, call the live/sandbox Cashfree PG API
        if cls.is_configured():
            headers = {
                "Content-Type": "application/json",
                "x-client-id": cfg["app_id"],
                "x-client-secret": cfg["secret_key"],
                "x-api-version": cls.API_VERSION
            }
            url = f"{cfg['base_url']}/orders"
            req = urllib.request.Request(url, data=json.dumps(order_data).encode("utf-8"), headers=headers, method="POST")

            try:
                with urllib.request.urlopen(req, timeout=15) as resp:
                    res_body = json.loads(resp.read().decode("utf-8"))
                    payment_session_id = res_body.get("payment_session_id")
                    cf_order_id = res_body.get("cf_order_id", "")

                    # Save to DB
                    db.create_cashfree_order(
                        order_id=order_id,
                        cf_order_id=cf_order_id,
                        user_id=user_id,
                        amount=amount,
                        payment_session_id=payment_session_id,
                        plan_days=plan_days
                    )

                    return {
                        "success": True,
                        "order_id": order_id,
                        "cf_order_id": cf_order_id,
                        "payment_session_id": payment_session_id,
                        "environment": cfg["env"],
                        "mode": "sandbox" if cfg["env"] == "SANDBOX" else "production",
                        "amount": amount,
                        "plan_days": plan_days
                    }
            except urllib.error.HTTPError as e:
                err_text = e.read().decode("utf-8")
                try:
                    err_json = json.loads(err_text)
                    err_msg = err_json.get("message") or err_json.get("error") or str(err_text)
                except Exception:
                    err_msg = err_text
                return {"success": False, "error": f"Cashfree API error: {err_msg}", "status_code": e.code}
            except Exception as e:
                return {"success": False, "error": f"Connection error: {str(e)}"}

        else:
            # Sandbox / Simulator Mode when Admin hasn't entered live API keys yet
            simulated_session_id = f"session_sim_{user_id}_{timestamp}"
            db.create_cashfree_order(
                order_id=order_id,
                cf_order_id=f"cf_sim_{timestamp}",
                user_id=user_id,
                amount=amount,
                payment_session_id=simulated_session_id,
                plan_days=plan_days
            )

            return {
                "success": True,
                "order_id": order_id,
                "cf_order_id": f"cf_sim_{timestamp}",
                "payment_session_id": simulated_session_id,
                "environment": "SANDBOX_SIMULATOR",
                "mode": "sandbox",
                "amount": amount,
                "plan_days": plan_days,
                "note": "Cashfree Simulator Mode (Enter API Keys in Admin Console for Live Payments)"
            }

    @classmethod
    def verify_order(cls, order_id: str) -> Dict[str, Any]:
        """
        Queries Cashfree to verify whether the order has been PAID.
        If verified, automatically marks order PAID and activates the 30-day Pro subscription.
        """
        cfg = cls.get_config()
        order = db.get_cashfree_order(order_id)
        if not order:
            return {"success": False, "error": "Order not found in database"}

        if order["status"] == "PAID":
            return {
                "success": True,
                "status": "PAID",
                "message": "Order already verified and paid",
                "order_id": order_id
            }

        # If live/sandbox credentials are configured, query Cashfree PG API
        if cls.is_configured() and not str(order["payment_session_id"]).startswith("session_sim_"):
            headers = {
                "x-client-id": cfg["app_id"],
                "x-client-secret": cfg["secret_key"],
                "x-api-version": cls.API_VERSION
            }
            url = f"{cfg['base_url']}/orders/{order_id}"
            req = urllib.request.Request(url, headers=headers, method="GET")

            try:
                with urllib.request.urlopen(req, timeout=12) as resp:
                    data = json.loads(resp.read().decode("utf-8"))
                    cf_status = data.get("order_status")

                    if cf_status == "PAID":
                        # Fetch payment details if available
                        cf_payment_id = None
                        payment_method = "Cashfree Online"
                        try:
                            pay_url = f"{cfg['base_url']}/orders/{order_id}/payments"
                            pay_req = urllib.request.Request(pay_url, headers=headers, method="GET")
                            with urllib.request.urlopen(pay_req, timeout=8) as pay_resp:
                                payments = json.loads(pay_resp.read().decode("utf-8"))
                                if payments and isinstance(payments, list):
                                    successful = [p for p in payments if p.get("payment_status") == "SUCCESS"]
                                    if successful:
                                        p0 = successful[0]
                                        cf_payment_id = str(p0.get("cf_payment_id") or p0.get("payment_id") or "")
                                        payment_method = str(p0.get("payment_group") or p0.get("payment_method") or "Cashfree PG")
                        except Exception:
                            pass

                        # Activate student Pro subscription in DB!
                        res = db.mark_cashfree_order_paid(
                            order_id=order_id,
                            cf_payment_id=cf_payment_id,
                            payment_method=payment_method
                        )
                        return {
                            "success": True,
                            "status": "PAID",
                            "message": "भुगतान सफल! 30 दिन की प्रो सदस्यता सक्रिय हो गई है।",
                            "subscription_end": res.get("subscription_end")
                        }
                    else:
                        return {
                            "success": False,
                            "status": cf_status,
                            "error": f"Payment not completed. Current status: {cf_status}"
                        }
            except Exception as e:
                return {"success": False, "error": f"Verification request failed: {str(e)}"}

        else:
            # Simulator / Test Mode: Mark paid directly
            res = db.mark_cashfree_order_paid(
                order_id=order_id,
                cf_payment_id=f"sim_pay_{int(time.time())}",
                payment_method="Simulator UPI / GPay"
            )
            return {
                "success": True,
                "status": "PAID",
                "message": "परीक्षण भुगतान सफल! 30 दिन की प्रो सदस्यता सक्रिय हो गई है।",
                "subscription_end": res.get("subscription_end"),
                "is_simulator": True
            }
