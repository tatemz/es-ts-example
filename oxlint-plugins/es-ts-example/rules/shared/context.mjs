export const sourceText = (context) => {
  const sourceCode = context.sourceCode ?? context.getSourceCode();
  return sourceCode.text ?? sourceCode.getText();
};

const filenameFor = (context) => context.filename ?? context.getFilename();

export const normalizedFilename = (context) => filenameFor(context).replace(/\\/g, "/");
