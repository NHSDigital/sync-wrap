SHELL := /bin/bash
########################################################################################################################
##
## Makefile for managing sync async
##
########################################################################################################################
compose_files = ${COMPOSE_FILES}
pwd := ${PWD}
dirname := $(notdir ${PWD})
features = features
modules :=async-slowapp sync-wrap

list:
	@grep '^[^#[:space:]].*:' Makefile

guard-%:
	@ if [ "${${*}}" = "" ]; then \
		echo "Environment variable $* not set"; \
		exit 1; \
	fi

clean:
	rm -rf ./build || true
	@for dir in . $(modules); do \
		make --no-print-directory -C proxies/$${dir} clean & \
	done; \
	wait

install:
	@for dir in . $(modules); do \
		make --no-print-directory -C proxies/$${dir} install & \
	done; \
	wait

clean-build:
	rm -rf ./build || true

build: clean-build
	@for dir in $(modules); do \
		make --no-print-directory -C proxies/$${dir} build & \
	done; \
	wait

build-proxy: build

deploy:
	@for dir in $(modules); do \
		make --no-print-directory -C proxies/$${dir} deploy & \
	done; \
	wait

ls:
	@for dir in $(modules); do \
		make --no-print-directory -C proxies/$${dir} ls & \
	done; \
	wait
