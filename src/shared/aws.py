import os
import json
import os
import re
import subprocess
from functools import wraps
from json import JSONDecodeError
from subprocess import Popen, PIPE, STDOUT
from time import sleep
from typing import Union, List, Tuple, Callable, Iterable, Dict, Generator, Any
from urllib import parse

import boto3
from boto3.dynamodb.types import TypeDeserializer
from botocore.config import Config
from botocore.exceptions import ClientError, UnknownServiceError

LOCAL_MODE = 'LOCAL_MODE'
AWS_REGION = 'eu-west-2'

_TEMP_LOCATION_KEY_PREFIX = "temp/"

s3re = re.compile(r'^(s3(?:a|n)?):\/\/([^\/]+)\/(.+)$', re.IGNORECASE)

def strtobool(val: Union[str, int, bool]) -> bool:
    if isinstance(val, bool):
        return val
    val = str(val).lower()
    if val in ('y', 'yes', 't', 'true', 'on', '1'):
        return True
    elif val in ('n', 'no', 'f', 'false', 'off', '0'):
        return False
    else:
        raise ValueError("invalid truth value %r" % (val,))


def s3_build_uri(bucket: str, key: str) -> str:
    return 's3://{}/{}'.format(bucket, key)


def s3_split_path(s3uri: str) -> Tuple[str, str, str]:
    match = s3re.match(s3uri)
    if not match:
        raise ValueError("Not a s3 uri: {}".format(s3uri))
    scheme, bucket, key = match.groups()
    return scheme, bucket, key


def local_mode() -> bool:
    return strtobool(os.environ.get(LOCAL_MODE, 'False'))


def boto3_thing(service: str, local_endpoint: str, factory: Callable) -> boto3.client:
    def _create() -> boto3.client:
        if local_mode():
            return factory(
                service, endpoint_url=local_endpoint, region_name=AWS_REGION,
                aws_access_key_id='abc', aws_secret_access_key='123'
            )

        return factory(service, region_name=AWS_REGION)

    boto_thing = _create()

    return boto_thing


def s3_resource() -> boto3.session.Session.resource:
    return boto3_thing('s3', 'http://{}:8080'.format(os.environ.get('LOCAL_S3_HOST', 'localhost')), boto3.resource)


def dynamodb() -> boto3.session.Session.resource:
    return boto3_thing('dynamodb', 'http://{}:4569'.format(os.environ.get('LOCAL_AWS_HOST', 'localhost')),
                       boto3.resource)


def dynamodb_client() -> boto3.session.Session.client:
    return boto3_thing('dynamodb', 'http://{}:4569'.format(os.environ.get('LOCAL_AWS_HOST', 'localhost')),
                       boto3.client)


def ddb_table(table_name: str):
    return dynamodb().Table(table_name)


def sqs():
    return boto3_thing('sqs', 'http://{}:4576'.format(os.environ.get('LOCAL_AWS_HOST', 'localhost')), boto3.client)


def ssm_client() -> boto3.client:
    return boto3_thing('ssm', 'http://{}:4583'.format(os.environ.get('LOCAL_AWS_HOST', 'localhost')), boto3.client)


def secrets_client() -> boto3.client:
    return boto3_thing(
        'secretsmanager', 'http://{}:4584'.format(os.environ.get('LOCAL_AWS_HOST', 'localhost')), boto3.client
    )


def ses_client(region_name: str, ses_proxy: str = None) -> boto3.client:
    return boto3.client('ses', region_name=region_name, config=Config(
        proxies={
            'https': f'http://{ses_proxy}:443'
        } if ses_proxy else {}
    ))


def secret_value(name: str) -> str:
    try:
        return secrets_client().get_secret_value(SecretId=name)["SecretString"]
    except UnknownServiceError:
        return get_secret_via_cli(name)


def secret_binary_value(name: str) -> bytes:
    try:
        return secrets_client().get_secret_value(SecretId=name)["SecretBinary"]
    except UnknownServiceError:
        return get_secret_binary_via_cli(name)


def rds_client() -> boto3.client:
    return boto3.client('rds', region_name=AWS_REGION)


# TODO when we have latest boto remove the conditional has_latest_boto logic below
def ssm_parameter(name: str, decrypt=False) -> Union[str, List[str]]:
    ssm = ssm_client()
    has_latest_boto = hasattr(ssm, "get_parameter")

    try:
        if has_latest_boto:
            return ssm.get_parameter(Name=name, WithDecryption=decrypt)['Parameter']['Value']
        else:
            return get_ssm_parameter_via_cli(name, decrypt)
    except Exception as e:
        raise ValueError("Failed to retrieve parameter {}".format(name)) from e


def get_ssm_parameter_via_cli(name: str, decrypt=False) -> Union[str, List[str], None]:
    endpoint = ''
    if local_mode():
        endpoint = '--endpoint http://localhost:4583'

    decryption_flag = "--with-decryption" if decrypt else "--no-with-decryption"
    cmd = 'aws {} --region eu-west-2 ssm get-parameter --name {} {}'.format(endpoint, name, decryption_flag)
    p = Popen(cmd, shell=True, stdin=PIPE, stdout=PIPE, stderr=STDOUT, close_fds=True)
    output = p.stdout.read()
    try:
        response = json.loads(output.decode("utf-8"))
        return response["Parameter"]["Value"]
    except JSONDecodeError:
        return None


def set_ssm_parameter_via_cli(name: str, value: str, description="", overwrite=False, key_id=None):
    endpoint = ''
    if local_mode():
        endpoint = '--endpoint http://localhost:4583'

    key_flag = "--key-id {}".format(key_id) if key_id is not None else ""
    overwrite_flag = "--overwrite" if overwrite else "--no-overwrite"
    cmd = 'aws {} --region eu-west-2 ssm put-parameter --name {} ' \
          '--description "{}" --value "{}" --type String {} {}' \
        .format(endpoint, name, description, value, overwrite_flag, key_flag)
    p = Popen(cmd, shell=True, stdin=PIPE, stdout=PIPE, stderr=STDOUT, close_fds=True)
    output = p.stdout.read()
    response = json.loads(output.decode("utf-8"))
    return response["Version"]


def get_secret_via_cli(name: str):
    cmd = 'aws --region eu-west-2 secretsmanager get-secret-value --secret-id {}'.format(name)
    p = Popen(cmd, shell=True, stdin=PIPE, stdout=PIPE, stderr=STDOUT, close_fds=True)
    output = p.stdout.read()
    response = json.loads(output.decode("utf-8"))
    return response["SecretString"]


def get_secret_binary_via_cli(name: str):
    cmd = 'aws --region eu-west-2 secretsmanager get-secret-value --secret-id {}'.format(name)
    p = Popen(cmd, shell=True, stdin=PIPE, stdout=PIPE, stderr=STDOUT, close_fds=True)
    output = p.stdout.read()
    response = json.loads(output.decode("utf-8"))
    return response["SecretBinary"]


def s3_bucket(bucket: str) -> boto3.session.Session.resource:
    return s3_resource().Bucket(bucket)


def s3_object(bucket_or_url: str, key: str = None) -> boto3.session.Session.resource:
    if key is not None:
        bucket = bucket_or_url
    else:
        url_parsed = parse.urlparse(bucket_or_url)
        bucket = url_parsed.netloc
        key = url_parsed.path.lstrip('/')

    return s3_resource().Object(bucket, key)


def s3_get_all_keys(bucket: str, prefix: str) -> List[str]:
    client = s3_resource().meta.client
    paginator = client.get_paginator('list_objects_v2')
    page_iterator = paginator.paginate(Bucket=bucket, Prefix=prefix)
    keys = []
    for page in page_iterator:
        for content in page['Contents']:
            keys.append(content['Key'])
    return keys


def s3_delete_keys(keys: Iterable[str], bucket: str):
    bc = s3_bucket(bucket)

    all_keys = [key for key in keys]

    if not all_keys:
        return []

    deleted = []

    batch = all_keys[:999]
    remaining = all_keys[999:]
    while batch:
        bc.delete_objects(
            Delete={'Objects': [{'Key': key} for key in batch]}
        )
        deleted.extend(batch)
        batch = remaining[:999]
        remaining = remaining[999:]

    return deleted


def s3_cleanup(extracts_bucket_name: str, extract_prefix: str):
    """
    Delete any objects in an S3 bucket with the given prefix
    """
    keys = s3_get_all_keys(bucket=extracts_bucket_name,
                           prefix=extract_prefix)
    s3_delete_keys(bucket=extracts_bucket_name, keys=keys)


def s3_ls(uri: str, recursive: bool = True, predicate: Callable[[str], bool] = None, versioning: bool = False):
    _, bucket, path = s3_split_path(uri)

    yield from s3_list_bucket(bucket, path, recursive=recursive, predicate=predicate, versioning=versioning)


def s3_list_bucket(
        bucket: str, prefix: str, recursive: bool = True, predicate: Callable[[str], bool] = None,
        versioning: bool = False) -> Generator[object, None, None]:
    """ list contents of S3 bucket based on filter criteria and versioning flag

    Args:
        bucket (str): bucket name to list contents of
        prefix (str): prefix to filter on
        recursive (bool): whether to recurse or not
        predicate (Callable[[str], bool]): predicate function to filter results on
        versioning (bool): whether to return objects or versions

    Returns:
        Generator[object, None, None]: resulting objects or versions
    """

    if versioning:
        bc_objects = s3_bucket(bucket).object_versions
    else:
        bc_objects = s3_bucket(bucket).objects

    for s3_obj in bc_objects.filter(Prefix=prefix, Delimiter='' if recursive else '/'):
        if predicate and not predicate(s3_obj.key):
            continue
        yield s3_obj


def s3_list_prefixes(s3_path: str):
    _na, bucket, prefix = s3_split_path(s3_path)

    if not prefix.endswith('/'):
        prefix = prefix + '/'

    client = boto3.client('s3')
    result = client.list_objects(Bucket=bucket, Prefix=prefix, Delimiter='/')
    return [o['Prefix'].replace(prefix, '').strip('/') for o in result.get('CommonPrefixes')]


def s3_sync_to_local(bucket_name: str, prefix: str, local_path: str, include=None, exclude=None):
    subprocess.check_output("aws {} s3 sync s3://{} {}{exclude}{include}".format(
        '--endpoint-url=http://{}:8080'.format(os.environ.get('LOCAL_S3_HOST', 'localhost')) if local_mode() else '',
        os.path.join(bucket_name, prefix), local_path,
        include=' --include "{}"'.format(include) if include is not None else "",
        exclude=' --exclude "{}"'.format(exclude) if exclude is not None else ""),
        shell=True)


def s3_get_size(bucket_name: str, prefix: str) -> int:
    """
    Get the size in bytes of the file(s) at/under the provided prefix
    """
    return sum([s3_obj.size for s3_obj in s3_bucket(bucket_name).objects.filter(Prefix=prefix)])


def s3_copy_object(source_url: str, destination_url: str):
    src_scheme, src_bucket_name, src_key = s3_split_path(source_url)  # pylint:disable=unused-variable
    dest_scheme, dest_bucket_name, dest_key = s3_split_path(destination_url)  # pylint:disable=unused-variable

    copy_source = {
        'Bucket': src_bucket_name,
        'Key': src_key
    }

    destination_buck = s3_bucket(dest_bucket_name)
    destination_buck.copy(copy_source, dest_key)


def s3_get_temp_path(s3_path: str) -> str:
    """
    Args: An s3 path e.g 's3://local-testing/mesh/2'
    Returns: The corresponding s3_path for temp files e.g 's3://local-testing/temp/mesh/2'
    """
    scheme, bucket, key = s3_split_path(s3_path)
    temp_path = '{scheme}://{bucket}/{temp}{key}'.format(scheme=scheme, bucket=bucket,
                                                         temp=_TEMP_LOCATION_KEY_PREFIX, key=key)
    return temp_path


def s3_is_temp_path(s3_uri: str) -> bool:
    """
    Determine whether a given S3 URI represents a temporary location

    Args:
        s3_uri: The URI to test

    Returns:
        Whether the URI appears to represent a temporary location
    """
    _, _, key = s3_split_path(s3_uri)
    return key.startswith(_TEMP_LOCATION_KEY_PREFIX)


def s3_upload_file(file_path: str, bucket: str, key: str):
    """
    Upload a file to a given S3 location
    Args:
        file_path: Path to file to be uploaded
        bucket: Target bucket
        key: Target key
    """
    client = s3_resource().meta.client
    client.upload_file(file_path, bucket, key)


def s3_create_presigned_url(bucket: str, key: str, expiration: int = 3600):
    """
    Creates a presigned url for a given S3 object
    Args:
        bucket: Target bucket
        key: Target key
        expiration: Time in seconds for the presigned URL to remain valid

    Returns:
        Presigned URL as string
    """
    client = s3_resource().meta.client
    params = {
        'Bucket': bucket,
        'Key': key
    }
    response = client.generate_presigned_url('get_object', Params=params, ExpiresIn=expiration)
    return response


def instance_profile_to_arn(instance_profile) -> str:
    if instance_profile.startswith("arn:aws:iam::"):
        return instance_profile

    account_id = ssm_parameter('/core/common/account_id')

    return "arn:aws:iam::{}:instance-profile/{}".format(account_id, instance_profile)



_RETRY_EXCEPTIONS = ('ProvisionedThroughputExceededException', 'ThrottlingException')


def dynamodb_retry_backoff(max_retries=6):
    """ retry dynamodb actions with exponential backoff of 2 ^ retries

    Args:
        max_retries (int): maximum number of retries default 6 = 64 seconds

    """

    def _wrapping(f):
        """Nested decorator.

        Args:
            f (function) - the function to be wrapped
        Returns:
            decorated function
        """

        @wraps(f)
        def _wrapper(*args, **kwargs):

            retries = 0
            while True:

                try:

                    result = f(*args, **kwargs)

                    return result

                except ClientError as err:

                    if err.response['Error']['Code'] not in _RETRY_EXCEPTIONS:
                        raise

                    if retries > max_retries:
                        raise

                    retries += 1
                    sleep(pow(2, retries))

        return _wrapper

    return _wrapping


@dynamodb_retry_backoff()
def get_items_batched(ddb_table_name: str, keys: List[Dict[str, Any]]) -> Dict[str, Any]:
    ddb = dynamodb_client()
    response = ddb.batch_get_item(
        RequestItems={
            ddb_table_name: {
                'Keys': keys
            }
        }
    )
    assert response['ResponseMetadata']['HTTPStatusCode'] == 200
    return response


def ddb_get_items(ddb_table_name: str, keys: List[Dict[str, Any]]) -> List[Dict[str, Any]]:
    result = []
    remaining = keys
    while remaining:
        batch = remaining[:100]
        remaining = remaining[100:]
        response = get_items_batched(ddb_table_name, batch)
        if response.get('Responses') and response['Responses'].get(ddb_table_name):
            result.extend(response['Responses'][ddb_table_name])
        if response.get('UnprocessedKeys') and response['UnprocessedKeys'].get(ddb_table_name):
            remaining = response['UnprocessedKeys'][ddb_table_name] + remaining
    return result


def ddb_query_batch_get_items(key_field: str, **kwargs) -> Generator[dict, None, None]:

    table_name = kwargs["TableName"]

    paginator = dynamodb_client().get_paginator('query')

    page_iterator = paginator.paginate(**kwargs)

    deserializer = TypeDeserializer()

    for page in page_iterator:

        keys = [{key_field: rec[key_field]} for rec in page['Items']]
        recs = len(keys)
        items = ddb_get_items(table_name, keys)
        for item in items:
            yield {k: deserializer.deserialize(v) for k, v in item.items()}


def ddb_query_paginate(**kwargs) -> Generator[dict, None, None]:

    paginator = dynamodb_client().get_paginator('query')

    page_iterator = paginator.paginate(**kwargs)

    for page in page_iterator:
        yield from page['Items']