/**
 * A planted SonarCloud failure (#655 DoD: "one planted ERROR watched red").
 * Untested, and more than the 20 new lines SonarCloud needs before it judges
 * coverage on new code (below 80% fails the gate). This branch is never merged.
 */
export function roll(): number {
  return Math.floor(Math.random() * 6) + 1;
}

export function plantedName(n: number): string {
  switch (n) {
    case 0:
      return 'planted-0';
    case 1:
      return 'planted-1';
    case 2:
      return 'planted-2';
    case 3:
      return 'planted-3';
    case 4:
      return 'planted-4';
    case 5:
      return 'planted-5';
    case 6:
      return 'planted-6';
    case 7:
      return 'planted-7';
    case 8:
      return 'planted-8';
    case 9:
      return 'planted-9';
    case 10:
      return 'planted-10';
    case 11:
      return 'planted-11';
    case 12:
      return 'planted-12';
    case 13:
      return 'planted-13';
    case 14:
      return 'planted-14';
    case 15:
      return 'planted-15';
    case 16:
      return 'planted-16';
    case 17:
      return 'planted-17';
    case 18:
      return 'planted-18';
    case 19:
      return 'planted-19';
    case 20:
      return 'planted-20';
    case 21:
      return 'planted-21';
    case 22:
      return 'planted-22';
    case 23:
      return 'planted-23';
    case 24:
      return 'planted-24';
    case 25:
      return 'planted-25';
    case 26:
      return 'planted-26';
    case 27:
      return 'planted-27';
    case 28:
      return 'planted-28';
    case 29:
      return 'planted-29';
    default:
      return 'planted';
  }
}
