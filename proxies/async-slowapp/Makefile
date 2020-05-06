


list:
	@grep '^[^#[:space:]].*:' Makefile

build:
	rm -rf ./dist || true
	mkdir ./dist
	cp -r ./apiproxy ./dist
	cp ./package*.json ./dist/apiproxy/resources/hosted
	cp -r ./src ./dist/apiproxy/resources/hosted

deploy: build
	cd ./dist && apigeetool deployproxy -V -o nhsd-nonprod -e internal-dev -n sync-wrap -t $$(get_token)

undeploy:
	apigeetool undeploy -V -o nhsd-nonprod -e internal-dev -n sync-wrap -t $(get_token)

delete:
	apigeetool delete -V -o nhsd-nonprod -n sync-wrap -t $(get_token)
install:
	npm install --dev