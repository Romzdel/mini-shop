// API.js, credits to G6 of IdeaRobin Inc.

import { ACCESS_401, ACCESS_403 } from './constants';
const config = require('config/app.json');
const headers = {
  'Content-Type': 'application/json',
  'Cache-Control': 'no-cache',
  'max-age': 0,
};

class API {
  constructor(token) {
    this.sending = false;
    this.host = process.env.API;
    /* istanbul ignore else: the above statement already covers else */
    if (!this.host) {
      this.host = config.api_host;
    }
    this.headers = headers;
    this._fullURL = this._fullURL.bind(this);

    this.delete = this.delete.bind(this);
    this.get = this.get.bind(this);
    this.post = this.post.bind(this);
    this.patch = this.patch.bind(this);
    this.put = this.put.bind(this);
    this.send = this.send.bind(this);
    this.token = token;
    this.url = this._fullURL();
    this.xhr = new XMLHttpRequest();
  }

  _fullURL(path) {
    return `${this.host}${path || ''}`;
  }

  _handle4XX(status_code) {
    switch (status_code) {
      case 401:
        return ACCESS_401;
      case 403:
        return ACCESS_403;
      default:
        return status_code;
    }
  }

  setURL(path) {
    this.url = this._fullURL(path);
  }

  /* istanbul ignore next: untestable for now */
  send(method, path, params, file) {
    return new Promise(resolve => {
      // eslint-disable-line no-unused-vars
      let data;
      let content_type = 'application/json;charset=UTF-8';
      if (this.sending) {
        this.xhr.abort();
        this.sending = false;
      }

      this.setURL(path);
      if (!!params && method === 'GET') {
        const s_qry = Object.keys(params)
          .map(k => `${encodeURIComponent(k)}=${encodeURIComponent(params[k])}`)
          .join('&');

        this.setURL(`${path}?${s_qry}`);
      } else if (file) {
        data = new FormData();
        data.append('document', file);
        content_type = '';
      } else if (params) {
        data = JSON.stringify(params);
      }

      if ('withCredentials' in this.xhr) {
        this.xhr.open(method, this.url, true);
      } else if (typeof XDomainRequest !== 'undefined') {
        this.xhr = new XDomainRequest();
        this.xhr.open(method, this.url);
      } else {
        this.xhr.open(method, this.url);
      }

      if (content_type) {
        this.xhr.setRequestHeader('Content-Type', content_type);
      }

      this.xhr.setRequestHeader('Cache-Control', 'no-cache');
      if (this.token) {
        this.xhr.setRequestHeader('Authorization', `Bearer ${this.token}`);
      }

      this.xhr.onload = () => {
        this.sending = false;

        if (!this.xhr.response) {
          return resolve({ success: false, status: this.xhr.status });
        }

        try {
          const json_response = JSON.parse(this.xhr.response);
          let success = json_response.success || json_response.Success;
          if (json_response.hasOwnProperty('Success')) { // eslint-disable-line
            // eslint-disable-line no-prototype-builtins
            delete json_response.Success;
            json_response.success = success;
          }

          if (this.xhr.status % 400 < 100) {
            json_response.message =
              json_response.message || json_response.error;
            json_response.error_type = this._handle4XX(this.xhr.status);
          }

          if (this.xhr.status >= 500) {
            success = false;
            resolve({
              ...json_response,
              success: false,
              status: this.xhr.status,
              message: 502,
            });
          }

          if (
            this.xhr.responseURL.includes('csv-templates/download') &&
            this.xhr.status === 200
          ) {
            resolve({
              success: true,
              status: this.xhr.status,
              data: this.xhr.response,
            });
          }

          if (json_response.data) {
            for (const key in json_response.data) {
              // eslint-disable-line no-restricted-syntax
              if (
                json_response.data.hasOwnProperty(key) && // eslint-disable-line
                !!json_response.data[key] &&
                typeof json_response.data[key] === 'object'
              ) {
                // eslint-disable-line no-prototype-builtins
                if (key.length > 3 && key.substr(-3) === '_id') {
                  const object_key = key.substr(0, key.length - 3);
                  json_response.data[object_key] = json_response.data[key];
                  if (json_response.data[object_key]._id) {
                    json_response.data[key] =
                      json_response.data[object_key]._id;
                  }
                }
              }
            }
          }

          return resolve({
            ...json_response,
            status: this.xhr.status,
            success,
          });
        } catch (e) {
          return resolve({ success: false, status: this.xhr.status, e });
        }
      };

      this.xhr.onerror = e => {
        this.sending = false;

        if (!this.xhr.status) {
          resolve({ success: false, status: 502, stack: e });
        } else if (this.xhr.response) {
          const json_resp = JSON.parse(this.xhr.response);
          resolve({ ...json_resp, status: this.xhr.status, stack: e });
        } else {
          resolve({ success: false, status: 502, stack: e });
        }
      };

      this.sending = true;
      try {
        if (data) {
          this.xhr.send(data);
        } else {
          this.xhr.send();
        }
      } catch (e) {
        console.log(e); // eslint-disable-line no-console
        resolve(null);
      }
    });
  }

  get(path, params) {
    return this.send('GET', path, params);
  }

  post(path, data = false) {
    return this.send('POST', path, data);
  }

  patch(path, data = false) {
    return this.send('PATCH', path, data);
  }

  put(path, data = false, file = false) {
    return this.send('PUT', path, data, file);
  }

  delete(path, data = false) {
    return this.send('DELETE', path, data);
  }
}

export default API;
