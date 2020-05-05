

build:
	rm -rf ./dist || true
	mkdir ./dist
	cp -r ./apiproxy ./dist
	cp ./package*.json ./dist/apiproxy/resources/hosted
	cp ./src/* ./dist/apiproxy/resources/hosted

deploy: build
	cd ./dist && apigeetool deployproxy -V -o nhsd-nonprod -e internal-dev -n synchrotron -t $$(get_token)


install:
	npm install --dev