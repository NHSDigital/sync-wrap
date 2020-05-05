import os


def project_dir(*paths) -> str:
    base_dir = os.path.abspath(os.path.join(os.path.dirname(__file__), '../../'))
    return os.path.join(base_dir, *paths)


def expand_path(path: str) -> str:

    return os.path.abspath(os.path.expanduser(os.path.expandvars(path)))