export const OPERATOR_NAME = "Veydrift Operator";

export function createStartupMessage(): string {
  return `${OPERATOR_NAME} workspace is ready`;
}

export function main(): void {
  console.info(createStartupMessage());
}

if (import.meta.main) {
  main();
}
