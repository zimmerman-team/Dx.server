import {DefaultCrudRepository} from '@loopback/repository';

export const duplicateName = async (
  name: string,
  isOwner: boolean,
  repo: DefaultCrudRepository<any, any, any>,
  userId: string,
) => {
  if (!isOwner) {
    return name;
  }
  // Check if name has been previously duplicated
  const isDuplicatedOnce = await repo.find({where: {name: `(Copy)${name}`}});

  const allAssets = await repo.find({where: {owner: userId}});
  const allCopies = allAssets.filter(asset => {
    // Check if name starts with "(Copy" followed by a number and ends with currentName
    const nameParts = asset.name.split(name);
    if (nameParts.length !== 2 || nameParts[1] !== '') return false;

    const prefix = nameParts[0];
    return /^\(Copy\d+\)$/.test(prefix); // Check if prefix is (CopyN)
  });

  const getHighestCopyNumber = () => {
    let highestN = 0;
    let highestCopy = null;

    allCopies.forEach(asset => {
      const match = asset.name.match(/^\(Copy(\d+)\)/);
      if (match) {
        const n = parseInt(match[1], 10);
        if (n > highestN) {
          highestN = n;
          highestCopy = asset;
        }
      }
    });
    return highestN;
  };

  if (isDuplicatedOnce.length === 0) {
    return `(Copy)${name}`;
  } else {
    const highestN = getHighestCopyNumber();
    const nextCopyNo = highestN === 0 ? 2 : highestN + 1;
    return `(Copy${nextCopyNo})${name}`;
  }
};
