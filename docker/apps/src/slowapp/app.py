import asyncio
import dataclasses
import json
import os
from datetime import datetime, date
from functools import partial
from typing import Any, Awaitable, Callable, Tuple, Union
from uuid import uuid4

from aiohttp import web
from aiohttp.abc import Request
from aiohttp.web import Application, get
from aiohttp.web_exceptions import HTTPError, HTTPNotFound
from aiohttp.web_routedef import delete, patch
from dateutil.relativedelta import relativedelta

from shared.version_data import FULL_VERSION_STRING


class AppJSONEncoder(json.JSONEncoder):

    def default(self, o):  # pylint: disable=method-hidden

        if isinstance(o, datetime):
            return o.isoformat()

        if isinstance(o, date):
            return o.strftime('%Y-%m-%d')

        if dataclasses.is_dataclass(o):
            return dataclasses.asdict(o)

        return json.JSONEncoder.default(self, o)


app_dumps = partial(json.dumps, cls=AppJSONEncoder)


def json_response(model_or_dict: Union[dict, str, Any], status: int = 200) -> web.Response:

    if isinstance(model_or_dict, web.Response):
        return model_or_dict

    if not model_or_dict:
        return web.json_response({}, status=status)

    if isinstance(model_or_dict, str):
        return web.json_response(text=model_or_dict, status=status)

    return web.json_response(model_or_dict, status=status, dumps=app_dumps)


class SlowApp(Application):  # pylint: disable=no-self-use

    def __init__(self):

        super().__init__(
            middlewares=[self.jsonify]
        )

        self.tracked = {}

        self.add_routes(
            [
                get('/_ping', self.ping_handler),
                get('/slow', self.slow_handler),
                patch('/slow', self.slow_handler),
                delete('/poll', self.delete_handler),
                get('/poll', self.poll_handler),
                get('/sub/_ping', self.ping_handler),
                get('/sub/slow', self.slow_handler),
                delete('/sub/poll', self.delete_handler),
                get('/sub/poll', self.poll_handler)
            ]
        )

    @web.middleware
    async def jsonify(
            self, request: web.Request,
            handler: Callable[[web.Request], Awaitable[Tuple[Union[dict, str, Any], int]]]
    ):

        task_uuid = None
        try:

            return json_response(await handler(request))

        except HTTPError as e:
            return e

        except Exception as _e:  # pylint: disable=broad-except
            return json_response(
                {
                    'message': f'system error',
                    'task_uuid': task_uuid

                }, 500
            )

    async def ping_handler(self, _request):
        return dict(version=FULL_VERSION_STRING)

    async def slow_handler(self, request):
        delay = request.query.get('delay', None)
        if delay:
            await asyncio.sleep(float(delay))

        complete_in = request.query.get('complete_in', 5)
        poll_id = request.query.get('id', uuid4().hex)
        final_status = request.query.get('final_status', 200)

        finish_at = datetime.now() + relativedelta(seconds=float(complete_in))

        self.tracked[poll_id] = dict(finish_at=finish_at, final_status=int(final_status))

        resp = web.json_response(
            status=202, headers={'Content-Location': os.path.join(str(request.url.parent), f'poll?id={poll_id}')}
        )
        resp.set_cookie('poll-count', '0')
        return resp

    async def delete_handler(self, request):

        poll_id = request.query.get('id')

        if poll_id not in self.tracked:
            raise HTTPNotFound()

        del self.tracked[poll_id]

        return ''

    async def poll_handler(self, request: Request):

        poll_id = request.query.get('id')

        poll_count = request.cookies.get('poll-count')

        if poll_count is not None:
            poll_count = str(int(poll_count) + 1)

        if poll_id not in self.tracked:
            resp = HTTPNotFound()
            if poll_count:
                resp.set_cookie('poll-count', poll_count)
            return resp

        status = self.tracked[poll_id]

        if datetime.now() < status['finish_at']:
            resp = web.json_response(
                status=202, headers={
                    'Content-Location': str(request.url)
                }
            )
            if poll_count:
                resp.set_cookie('poll-count', poll_count)
            return resp

        del self.tracked[poll_id]

        resp = web.json_response(status=status['final_status'])

        if poll_count:
            resp.set_cookie('poll-count', poll_count)
        return resp
