#!/usr/bin/env python
# -*- encoding: utf-8 -*-

import os.path
import sys
from glob import glob

from setuptools import setup, find_packages

sys.path.append(os.path.join(os.path.dirname(__file__), 'src'))
from shared.version_data import FULL_VERSION_STRING


def get_console_scripts_from_utilities():
    console_scripts = []
    for filename in glob('src/utility/*.py'):
        mod_name = os.path.splitext(os.path.basename(filename))[0]
        if mod_name == '__init__':
            continue
        console_scripts.append('{mod_name} = utility.{mod_name}:main'.format(mod_name=mod_name))
    return console_scripts


def get_requirements(req_file='requirements.txt'):
    try:
        return open(os.path.join(os.path.dirname(__file__), req_file)).readlines()
    except OSError:
        return []


setup(
    name='sync-async',
    version=FULL_VERSION_STRING,
    description='apm sync async',
    author='ddc',
    author_email='dspp@nhs.net',
    url='',
    packages=find_packages('src'),
    package_dir={'': 'src'},
    py_modules=[os.path.splitext(os.path.basename(path))[0] for path in glob('src/*.py')],
    include_package_data=True,
    # package_data={'': ['*.mdb']},  # these dont seem to work
    # exclude_package_data={'': ['*.mdb']},  # these dont seem to work
    install_requires=[
        'requests',
    ],
    setup_requires=[
        'setuptools >= 21.0.0',
        'wheel',
    ],
    tests_require=[],
    extras_require={},
    entry_points={
        'console_scripts': [
            *get_console_scripts_from_utilities(),
        ]
    },
    ext_modules=[],
    data_files=[]
)
