export const writeError = (message: string): void => {
  process.stderr.write(`${message}\n`);
};

export const failPolicy = (message: string): never => {
  writeError(message);
  process.exit(1);
};
