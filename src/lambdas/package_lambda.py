import os
import shutil
import subprocess
from uuid import uuid4
from pipfile import Pipfile
import argparse

from shared import project_dir, expand_path


def package_lambda(function: str, src: str = None, dest_dir: str = None, pipfile: str = None, overwrite: bool = False) -> str:

    cache_dir = project_dir('.venv/lib/python3.7/site-packages')
    assert os.path.exists(cache_dir)

    src = expand_path(src or project_dir(f"src/lambdas/{function}.py"))
    assert os.path.exists(src)

    pip_file = expand_path(pipfile or project_dir('Pipfile'))
    assert os.path.exists(pip_file)
    parsed = Pipfile.load(pip_file)

    output = expand_path(dest_dir or f"/tmp/lambda-{uuid4().hex}")

    if os.path.exists(output) and not os.path.isdir(output):
        raise IOError(f'dest {output} is not a directory')

    if os.path.exists(output) and len(os.listdir(output)) > 0:
        if not overwrite:
            raise IOError(f'directory not empty {output}  .. set --overwrite to clear')
        shutil.rmtree(output)

    os.makedirs(output, exist_ok=True)

    shutil.copy(src, os.path.join(output, f"{function}.py"))

    for lib, version in parsed.data['default'].items():
        lib = lib if version == "*" else f"{lib}{version}"

        subprocess.check_output(
            f"pip install --upgrade --target {output} --cache-dir {cache_dir} {lib}".split(' ')
        )

    return output


if __name__ == '__main__':

    parser = argparse.ArgumentParser(description='generate a lambda zip')
    parser.add_argument('function', type=str, help='target lambda function name')
    parser.add_argument('--src', type=str, help='explicit lambda function src ( defaults to src/lambdas/{function}.py')
    parser.add_argument('--dest-dir', type=str, help='path to destination file; temp folder will be generated if')
    parser.add_argument('--pipfile', type=str, help='path to the pipfile to get packages from')
    parser.add_argument('--overwrite', action="store_true", help='will clear the output directory if set')

    args = parser.parse_args()

    dest = package_lambda(args.function, args.src, args.dest_dir, args.pipfile, args.overwrite)

    print(dest)
