export default function turnDataIntoAction(data: string, prefix: string): string {
  return `${prefix}_${data}`;
}
