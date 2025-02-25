export const duplicateName = (name: string, isOwner: boolean) => {
  if (!isOwner) {
    return name;
  }

  const copyRegex = /\(Copy\d*\)/g;
  const matches = name.match(copyRegex);
  if (matches) {
    const lastMatch = matches[matches.length - 1];
    const copyNumber =
      lastMatch === '(Copy)' ? 2 : parseInt(lastMatch.replace(/\D/g, '')) + 1;
    return name.replace(copyRegex, `(Copy${copyNumber})`);
  } else {
    return `(Copy)${name}`;
  }
};
