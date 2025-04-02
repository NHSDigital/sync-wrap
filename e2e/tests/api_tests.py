from os import getenv
from time import sleep
from typing import List

import pytest
import requests


def dict_path(raw, path: List[str]):
    if not raw:
        return raw

    if not path:
        return raw

    res = raw.get(path[0])
    if not res or len(path) == 1 or type(res) != dict:
        return res

    return dict_path(res, path[1:])


@pytest.mark.e2e
@pytest.mark.smoketest
def test_wait_for_ping(nhsd_apim_proxy_url):
    retries = 0
    resp = requests.get(f"{nhsd_apim_proxy_url}/_ping", timeout=30)
    deployed_commit_id = resp.json().get("commitId")

    while deployed_commit_id != getenv("SOURCE_COMMIT_ID") and retries <= 30:
        resp = requests.get(f"{nhsd_apim_proxy_url}/_ping", timeout=30)

        if resp.status_code != 200:
            pytest.fail(f"Status code {resp.status_code}, expecting 200")

        deployed_commit_id = resp.json().get("commitId")
        retries += 1
        sleep(1)

    if retries >= 30:
        pytest.fail("Timeout Error - max retries")

    assert deployed_commit_id == getenv("SOURCE_COMMIT_ID")


@pytest.mark.e2e
@pytest.mark.smoketest
def test_check_status_is_secured(nhsd_apim_proxy_url):
    resp = requests.get(f"{nhsd_apim_proxy_url}/_status")
    assert resp.status_code == 401

# @pytest.mark.e2e
# @pytest.mark.smoketest
# @pytest.mark.asyncio
# async def test_wait_for_status(
#         api_client: APISessionClient, api_test_config: APITestSessionConfig
# ):
#     async def is_deployed(resp: ClientResponse):
#         if resp.status != 200:
#             return False
#         body = await resp.json()
#
#         if body.get("commitId") != api_test_config.commit_id:
#             return False
#
#         backend = dict_path(body, ["checks", "healthcheck", "outcome", "version"])
#
#         if type(backend) != dict:
#             return False
#
#         return backend.get("commitId") == api_test_config.commit_id
#
#     await poll_until(
#         make_request=lambda: api_client.get(
#             "_status", headers={"apikey": env.status_endpoint_api_key()}
#         ),
#         until=is_deployed,
#         timeout=120,
#     )
#
#
# @pytest.mark.e2e
# @pytest.mark.asyncio
# async def test_api_status_with_service_header_another_service(api_client: APISessionClient):
#
#     r = await api_client.get(
#         "_status", allow_retries=True, max_retries=5,
#         headers={
#             'x-apim-service': 'async-slowapp',
#             'apikey': env.status_endpoint_api_key()
#         }
#     )
#     assert r.status == 200, (r.status, r.reason, (await r.text())[:2000])
#     body = await r.json()
#
#     service = dict_path(body, ["checks", "healthcheck", "outcome", "service"])
#
#     assert service == 'sync-wrap'
#
#
# @pytest.mark.e2e
# @pytest.mark.asyncio
# async def test_api_status_with_service_header(api_client: APISessionClient):
#
#     r = await api_client.get(
#         "_status", allow_retries=True, max_retries=5,
#         headers={
#             'x-apim-service': 'sync-wrap',
#             'apikey': env.status_endpoint_api_key()
#         }
#     )
#     assert r.status == 200, (r.status, r.reason, (await r.text())[:2000])
#     body = await r.json()
#
#     service = dict_path(body, ["checks", "healthcheck", "outcome", "service"])
#
#     assert service == 'sync-wrap'
#
#
# @pytest.mark.e2e
# @pytest.mark.asyncio
# async def test_api_slowapp_slower_than_sync_wait(api_client: APISessionClient):
#
#     r = await api_client.get(
#         "async-slowapp/slow?delay=5", allow_retries=True, max_retries=5, headers={'x-sync-wait': '0.25'}
#     )
#     assert r.status == 504, (r.status, r.reason, (await r.text())[:2000])
#
#
# @pytest.mark.e2e
# @pytest.mark.asyncio
# async def test_api_slowapp_responds_test_final_status(api_client: APISessionClient):
#
#     r = await api_client.get("async-slowapp/slow?final_status=418&complete_in=0.5", allow_retries=True, max_retries=5)
#     assert r.status == 418, (r.status, r.reason, (await r.text())[:2000])
#     assert r.reason == "I'm a Teapot"
