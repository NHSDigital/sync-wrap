FROM python:3.7-slim as base
##################################################################
FROM base as builder
RUN pip3 install --no-cache-dir --upgrade virtualenv==16.7.9 pip==18.1 pipenv \
    && mkdir /install

WORKDIR /install

COPY docker/apps/Pipfile .
COPY docker/apps/Pipfile.lock .

RUN PIPENV_VENV_IN_PROJECT=1 PIPENV_NOSPIN=1 pipenv install


##################################################################

FROM base

ENV PYTHONPATH=/src

#Standard nginx setup start
RUN apt-get update && \
    apt-get install --no-install-recommends --no-install-suggests -y \
        nginx \
        bash \
        supervisor \
        curl \
        libcap2-bin \
        socat \
        less \
    && apt-get clean \
    && useradd -s /bin/false nginx \
    # this is to allow SHA1 certs to be used on debian buster
    && sed -i 's#CipherString = DEFAULT@SECLEVEL=2#CipherString = DEFAULT@SECLEVEL=1#' /etc/ssl/openssl.cnf


COPY --from=builder /install /src

COPY docker/apps/entrypoint.sh /entrypoint.sh
RUN chmod +x /entrypoint.sh \
    && ln -s /src /install \
    && unlink /usr/local/bin/python \
    && ln -s /src/.venv/bin/python /usr/local/bin/python \
    && mkdir -p /certs/

COPY docker/apps/src/ /src/
# `docker/apps/src/shared` is symlinked
RUN unlink /src/shared
COPY src/shared/ /src/shared


RUN /src/.venv/bin/python /src/.venv/bin/pipdeptree -w fail

RUN touch /var/run/nginx.pid \
    && chown -R nobody: /certs /var/log/nginx /var/tmp /var/lib/nginx /var/run/nginx.pid \
    && chmod 777 /var/run \
    && touch /supervisord.log \
    && chown nobody: /supervisord.log \
    && setcap CAP_NET_BIND_SERVICE=+eip /usr/sbin/nginx
USER nobody

ENTRYPOINT ["/entrypoint.sh"]
CMD ["--help"]
