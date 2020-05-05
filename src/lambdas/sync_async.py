import base64
import json
import logging
import os
from contextlib import closing
from http.client import responses
from typing import List, Tuple, Type
from urllib.parse import urljoin, urlencode, urlsplit, urlunsplit

import requests
from pip._vendor.urllib3 import HTTPResponse
from requests import Response
from requests.exceptions import HTTPError

LOGGER = logging.getLogger()
LOGGER.setLevel(logging.INFO)


def response(body, status=200, headers=None) -> dict:
    res = dict(
        body=body,
        status=status,
        statusDescription=responses[status]
    )
    if headers:
        res['headers'] = headers
    return res


def http_error(err: HTTPError, headers=None) -> dict:
    headers = headers or {}
    return response(str(err), 5000, headers)


def error(errors: List[Tuple[Type, str]], status, headers=None) -> dict:

    return response(json.dumps(dict(errors=[dict(type=et.__name__, msg=em) for et, em in errors])), status, headers)


def handler(event, context):
    LOGGER.info("I've been called!")

    try:
        proxy_path = event["pathParameters"]['proxy+']
        headers = event["headers"]

        if 'Host' in headers:
            del headers['Host']

        if 'Content-Length' in headers:
            del headers['Content-Length']

        headers['X-Forwarded-For'] = event['requestContext']['identity']['sourceIp']

        method = getattr(requests, event["httpMethod"].lower())

        query = event['queryStringParameters']
        sync_timeout = query.get('syncWait')
        if sync_timeout:
            sync_timeout = int(sync_timeout)
            del query["syncWait"]
        else:
            sync_timeout = 60

        if sync_timeout < 1 or sync_timeout > 899:
            raise ValueError("syncWait should be between 0 and 900")

        upstream = os.environ['upstream']
        _, _, _, _, fragment = urlsplit(event["resource"])  # is fragment needed at all
        scheme, netloc, base_path, _, fragment = urlsplit(upstream)

        qs = urlencode(query, doseq=True)
        uri = urlunsplit((scheme, netloc, urljoin(base_path, proxy_path), qs, fragment))

    except (KeyError, ValueError) as e:
        return error([(type(e), str(e))], 400)

    allow_insecure = os.environ.get('allow_insecure') == "true"

    is_base64 = event.get('isBase64Encoded', False)

    kwargs = dict(
        headers=headers,
        timeout=sync_timeout,
        stream=True
    )

    if is_base64:
        kwargs['data'] = base64.b64decode(event["body"])
    else:
        kwargs['text'] = event["body"]

    if allow_insecure:
        kwargs['verify'] = False

    try:
        with closing(method(uri, **kwargs)) as resp:  # type: Response

            # todo: requests doesn't deal with multi value headers
            # multiValueHeaders should be set for lambda

            if resp.status_code == 200:
                return {
                    'statusCode': resp.status_code,
                    'headers': {k: v for k, v in resp.headers.items()},
                    'isBase64Encoded': True,
                    "body": base64.b64encode(resp.content).decode()
                }



        return None
    except HTTPError as e:
        return http_error(e)


