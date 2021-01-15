import pytest
from aiohttp import ClientResponse
from api_test_utils import poll_until
from api_test_utils.api_session_client import APISessionClient
from api_test_utils.api_test_session_config import APITestSessionConfig


@pytest.mark.smoketest
@pytest.mark.asyncio
async def test_wait_for_ping(api_client: APISessionClient, api_test_config: APITestSessionConfig):

    async def _is_complete(resp: ClientResponse):

        if resp.status != 200:
            return False
        body = await resp.json()
        return body.get("commitId") == api_test_config.commit_id

    await poll_until(
        make_request=lambda: api_client.get('_ping'),
        until=_is_complete,
        timeout=120
    )


@pytest.mark.smoketest
@pytest.mark.asyncio
async def test_wait_for_status(api_client: APISessionClient, api_test_config: APITestSessionConfig):

    async def _is_complete(resp: ClientResponse):

        if resp.status != 200:
            return False
        body = await resp.json()
        version_info = body.get('_version')
        if not version_info:
            return False

        return version_info.get("commitId") == api_test_config.commit_id

    await poll_until(
        make_request=lambda: api_client.get('_status'),
        until=_is_complete,
        timeout=120
    )


@pytest.mark.smoketest
@pytest.mark.asyncio
async def test_api_status_with_service_header_another_service(api_client: APISessionClient):

    r = await api_client.get("_status", allow_retries=True, max_retries=5, headers={'x-apim-service': 'async-slowapp'})
    assert r.status == 200, (r.status, r.reason, (await r.text())[:2000])
    body = await r.json()

    assert body.get('service') == 'sync-wrap'


@pytest.mark.smoketest
@pytest.mark.asyncio
async def test_api_status_with_service_header(api_client: APISessionClient):

    r = await api_client.get("_status", allow_retries=True, max_retries=5, headers={'x-apim-service': 'sync-wrap'})
    assert r.status == 200, (r.status, r.reason, (await r.text())[:2000])
    body = await r.json()

    assert body.get('service') == 'sync-wrap'


@pytest.mark.asyncio
async def test_api_slowapp_slower_than_sync_wait(api_client: APISessionClient):

    r = await api_client.get("async-slowapp/slow?delay=5", allow_retries=True, max_retries=5, headers={'x-sync-wait': '0.25'})
    assert r.status == 504, (r.status, r.reason, (await r.text())[:2000])


@pytest.mark.asyncio
async def test_api_slowapp_responds_test_final_status(api_client: APISessionClient):

    r = await api_client.get("async-slowapp/slow?final_status=418&complete_in=0.5", allow_retries=True, max_retries=5)
    assert r.status == 418, (r.status, r.reason, (await r.text())[:2000])
    assert r.reason == "I'm a Teapot"
