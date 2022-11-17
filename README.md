# File-Api

This file api repo is dedicated for all files related services to handle.



## How to use


## Development

### Prerequisite
* Practera CORE docker up

### Installation
1. `npm install`

### Start lambda function on local
1. Create `.env` file and modify or add parameters if needed `cp env.example .env`
1. Run `npm run dev` to start a serverless lambda funtion on local

### Trigger lambda function
1. Open another terminal window, under the same directory, run `node trigger.js` to trigger the lambda function

## Testing



## Unit Test


## Logging
- We use [DAZN Lambda Powertools](https://github.com/getndazn/dazn-lambda-powertools) as the error logging tool.
- Environment variable `LOG_LEVEL` has 4 values:
 - `DEBUG` - Display all logs
 - `INFO` - Display `Log.info()` logs and above
 - `WARN` - Display `Log.warn()` logs and above
 - `ERROR` - Display `Log.error()` only
- Environment variable `SAMPLE_DEBUG_LOG_RATE` controls the sampling rate of debug logs
 - By default it is 0.01, that means we will log debug logs for 1% of the requests
 - If we wanna enable debug logs for all services that is related to the current service, we can change it to 1. **Note: Remember to change it back to 0.01 after debugging, as this will increase the AWS cost**
