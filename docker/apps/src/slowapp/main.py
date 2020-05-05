from aiohttp import web

from slowapp.app import SlowApp

app = SlowApp()

if __name__ == '__main__':
    web.run_app(app, port=9003)
