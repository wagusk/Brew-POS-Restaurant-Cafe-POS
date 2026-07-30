"""WebSocket routes."""
from fastapi import APIRouter, WebSocket, WebSocketDisconnect
from app.ws import manager

router = APIRouter()


@router.websocket("/ws")
async def ws_endpoint(ws: WebSocket):
    await manager.connect(ws)
    try:
        await ws.send_json({"event": "hello", "data": {"connections": manager.count}})
        while True:
            # Client can send pings/role hints; we don't need them to function.
            msg = await ws.receive_text()
            if msg:
                # Echo back as a heartbeat so they know the line is alive.
                await ws.send_json({"event": "pong", "data": {"connections": manager.count}})
    except WebSocketDisconnect:
        pass
    finally:
        await manager.disconnect(ws)
