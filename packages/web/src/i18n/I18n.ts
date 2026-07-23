export type AnyMessages = Readonly<Record<string, string>>;

type MessageDescriptor<Messages extends AnyMessages, Id extends string & keyof Messages> = {
  readonly id: Id;
};

export interface I18n<Messages extends AnyMessages> {
  readonly _: <Id extends string & keyof Messages>(
    descriptor: MessageDescriptor<Messages, Id>,
  ) => string;
}

export const make = <const Messages extends AnyMessages>(opts: {
  readonly messages: Messages;
}): I18n<Messages> => ({
  _: (descriptor) => {
    const value = opts.messages[descriptor.id];
    return value === undefined ? descriptor.id : value;
  },
});
