# Sabre Node.js SDK

Node.js library for the Sabre API (SOAP).

## Install

```bash
npm install sabre-legacy-client
```

## Setup

First, you need to get an username, password and pcc which is available in the [DEV STUDIO - Applications](https://developer.sabre.com/my-account/applications).

```js
import { SabreLegacy } from 'sabre-legacy-client';

const sabre = new SabreLegacy({
  username: '773400', 
  password: 'PASSWORD_GOES_HERE',
  organization: '7TZA', // pcc
});
```

## Documentation

See http://developer.sabre.com

## Usage

The Create Session service is utilized to initiate a SOAP API session.

```js
await sabre.authentication.sessionCreate();
```

## Close session

This service is required to close connections because it properly cleans up the session and releases all resources allocated behind the scenes.

```js
await sabre.authentication.sessionClose();
```

## Validate session

The Refresh Session service is used to refresh a connection by resetting the connection's timestamp, thereby preventing the connection from being closed due to inactivity.

```js
await sabre.authentication.ping();
```

## Create access token

The Create Access Token is utilized to request a access token.

```js
await sabre.authentication.tokenCreate();
```

## Get Queue Count

The Get Queue Count service is used to display the count of messages or Passenger Name Records (PNRs) on an alphabetic, numeric, and branch queues.

```js
const count = await sabre.queue.count({
  pcc: "IPCC1",
});
```

## Access queue

The Access Queue API is used to access a designated queue or to navigate within the particular queue.

```js
const access = await sabre.queue.access({
  number: "200",
  pcc: "IPCC1",
});
```

Get PNR list from queue (Stateless)

```js
const accessList = await sabre.queue.accessList({
  number: "200",
  pcc: "IPCC1",
  primaryPassenger: true
});
```


## Queue ignore

This service is used for ignore transaction.

```js
const ignore = await sabre.queue.ignore();
```

## Queue remove

This service is used for queue remove.

```js
const remove = await sabre.queue.remove();
```

## Queue exit

This service is used for queue exit.

```js
const exit = await sabre.queue.exit();
```

## Place queue message

The Place Queue Message is used to place a message or Passenger Name Record (PNR) on a designated queue.

```js
const place = await sabre.queue.place({
  number: "400", // place to
  pcc: "IPCC1", 
});
```

## Get Sales Report

The Get Sales Reports service is used to display an audit trail for a particular agency, listing relevant transactions for a particular date or range of dates.

```js
const report = await sabre.dailySales.report({
  pcc: 'IPCC1', 
  date: '2012-12-21', // ISO Date "YYYY-MM-DD"
});
```

## Display Audit Trail

The Display Audit Trail web service provides the ability to retrieve e-Ticket Reports (Sale or Refund) for any ticketing platform supported in Sabre TN markets

```js
const summary = await sabre.dailySales.summary({
  pcc: 'WD40',
  airline: {
    code: 'AA'
  },
  date: '2016-10-20', // ISO Date "YYYY-MM-DD"
  settlementType: 'TKT',
  documentType: 'RFND'
});
```

## Development

#### Install dependencies

```sh
npm install
```

#### Build and run packages

```sh
npm dev
```

## Authors

- Carlos Ivan Soto ([carlosivansotop](https://www.linkedin.com/in/carlosivansotop/))

## License

MIT License