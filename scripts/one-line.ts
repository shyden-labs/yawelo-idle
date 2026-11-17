/**
 * Makes outside text one line before a script prints it (#1007). A GitHub
 * Actions log reads each line on its own and runs a line starting `::` as a
 * workflow command, so a line break inside a reply from Cloudflare, GitHub or
 * dev could plant one (SonarCloud tssecurity:S5145).
 */
export function oneLine(text: string): string {
  return text.replace(/\r\n|\r|\n/g, ' ');
}
