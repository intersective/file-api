export import Log = require('@dazn/lambda-powertools-logger');
export const success = (data: any) => {
  return {
    success: true,
    data
  };
}

export const error = (data: any) => {
  return {
    success: false,
    data
  };
}

export const debug = Log.debug;
