SHELL := /bin/bash
activate = pipenv run
pwd := ${PWD}
dirname := $(notdir ${PWD})
export PIPENV_VENV_IN_PROJECT = 1
export PIPENV_IGNORE_VIRTUALENVS = 1
export PIPENV_NO_INHERIT = 1
export PIPENV_MAX_DEPTH = 1
export PIPENV_NOSPIN = 1


guard-%:
	@ if [ "${${*}}" = "" ]; then \
		echo "Environment variable $* not set"; \
		exit 1; \
	fi

ensure-pipenv:
	@ if [[ ! -d .venv ]]; then \
		make pipenv; \
	fi

pipenv:
	pipenv clean
	pipenv run pip install pip==18.01

install: ensure-pipenv
	pipenv update
	pipenv install --dev


docker-build:
	docker build -t syncapps -f ./Dockerfile ../../


docker-runbash-nobuild:
	docker run --name syncapps --rm -it --entrypoint '' syncapps bash

docker-runbash: docker-build docker-runbash-nobuild

docker-run: docker-build
	docker run -p 9003:443 --name syncapps --rm -d syncapps slowapp
	@echo connect to https://localhost:8050

docker-attach:
	docker exec -it syncapps bash

docker-stop:
	docker stop syncapps

run:
	PYTHONPATH='./src' python .venv/bin/gunicorn slowapp.main:app --reload -b :9003