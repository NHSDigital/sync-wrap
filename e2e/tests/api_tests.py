import pytest
from aiohttp import ClientResponse
from api_test_utils import poll_until
from api_test_utils.api_session_client import APISessionClient
from api_test_utils.api_test_session_config import APITestSessionConfig


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
        timeout=60
    )


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
        timeout=60
    )


@pytest.mark.asyncio
async def test_api_status_with_service_header_another_service(api_client: APISessionClient):

    async with api_client.get("_status", headers={'x-apim-service': 'async-slowapp'}) as r:
        assert r.status == 200
        body = await r.json()

        assert body.get('service') == 'sync-wrap'


@pytest.mark.asyncio
async def test_api_status_with_service_header(api_client: APISessionClient):

    async with api_client.get("_status", headers={'x-apim-service': 'sync-wrap'}) as r:
        assert r.status == 200
        body = await r.json()

        assert body.get('service') == 'sync-wrap'


@pytest.mark.asyncio
async def test_api_slowapp_slower_than_sync_wait(api_client: APISessionClient):

    async with api_client.get("async-slowapp/slow?delay=5", headers={'x-sync-wait': '0.25'}) as r:
        assert r.status == 504


@pytest.mark.asyncio
async def test_api_slowapp_responds_test_final_status(api_client: APISessionClient):

    async with api_client.get("async-slowapp/slow?final_status=418&complete_in=0.5") as r:
        assert r.status == 418
        assert r.reason == "I'm a teapot"
