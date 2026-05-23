import asyncio
import base64
import json
import sys


def emit(payload):
    print(json.dumps(payload, ensure_ascii=False), flush=True)


async def main():
    try:
        from qqmusic_api import Client
        from qqmusic_api.modules.login import QRLoginType, QRCodeLoginEvents
    except Exception:
        emit({
            "type": "error",
            "message": "缺少 qqmusic-api-python，请先运行：python -m pip install qqmusic-api-python"
        })
        return 2

    try:
        async with Client() as client:
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
                    emit({"type": "status", "status": "scanned", "message": "已扫码，请在手机上确认"})
                elif result.event == QRCodeLoginEvents.CONF:
                    emit({"type": "status", "status": "confirming", "message": "正在确认 QQ 音乐登录"})
                elif result.event == QRCodeLoginEvents.TIMEOUT:
                    emit({"type": "error", "message": "二维码已过期，请重新刷新"})
                    return 1
                elif result.event == QRCodeLoginEvents.REFUSE:
                    emit({"type": "error", "message": "已拒绝 QQ 音乐登录"})
                    return 1
                await asyncio.sleep(2)

            if credential is None:
                emit({"type": "error", "message": "扫码登录超时，请重新刷新"})
                return 1

            data = credential.model_dump() if hasattr(credential, "model_dump") else {}
            emit({"type": "credential", "credential": data})
            return 0
    except Exception as exc:
        emit({"type": "error", "message": str(exc)})
        return 1


if __name__ == "__main__":
    sys.exit(asyncio.run(main()))
