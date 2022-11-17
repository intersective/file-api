export const Log = {
  debug: jest.fn(),
  info: jest.fn(),
  warn: jest.fn(),
  error: jest.fn(),
};
export const success = (x: any) => x;
export const error = jest.fn();
