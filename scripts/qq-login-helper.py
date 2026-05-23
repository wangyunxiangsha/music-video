import asyncio
import base64
import json
import sys


def emit(payload):
    print(json.dumps(payload, ensure_ascii=True), flush=True)


async def safe_close(client):
    try:
        await client.close()
    except RuntimeError as exc:
        if "Event loop is closed" not in str(exc):
            raise


async def main():
    try:
        from qqmusic_api import Client
        from qqmusic_api.modules.login import QRLoginType, QRCodeLoginEvents
    except Exception:
        emit({
            "type": "error",
            "message": "Missing qqmusic-api-python. Run: python -m pip install qqmusic-api-python"
        })
        return 2

    client = Client()
    try:
        qr = await client.login.get_qrcode(QRLoginType.QQ)
        data_url = "data:%s;base64,%s" % (
            qr.mimetype,
            base64.b64encode(qr.data).decode("ascii")
        )
        emit({"type": "qr", "dataUrl": data_url})

        credential = None
        for _ in range(120):
            result = await client.login.check_qrcode(qr)
            if result.event == QRCodeLoginEvents.DONE:
                credential = result.credential
                break
            if result.event == QRCodeLoginEvents.SCAN:
                emit({"type": "status", "status": "scanned", "message": "Scanned. Confirm on your phone."})
            elif result.event == QRCodeLoginEvents.CONF:
                emit({"type": "status", "status": "confirming", "message": "Confirming QQ Music login."})
            elif result.event == QRCodeLoginEvents.TIMEOUT:
                emit({"type": "error", "message": "QR code expired. Refresh and scan again."})
                return 1
            elif result.event == QRCodeLoginEvents.REFUSE:
                emit({"type": "error", "message": "QQ Music login was refused."})
                return 1
            await asyncio.sleep(2)

        if credential is None:
            emit({"type": "error", "message": "QR login timed out. Refresh and scan again."})
            return 1

        data = credential.model_dump() if hasattr(credential, "model_dump") else {}
        emit({"type": "credential", "credential": data})
        return 0
    except Exception as exc:
        if "Event loop is closed" in str(exc):
            emit({"type": "error", "message": "QQ login connection closed. Refresh and scan again."})
            return 1
        emit({"type": "error", "message": str(exc)})
        return 1
    finally:
        await safe_close(client)


if __name__ == "__main__":
    sys.exit(asyncio.run(main()))
