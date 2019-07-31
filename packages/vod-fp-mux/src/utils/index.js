export const checkCombine = (tracks) => {
    return Object.values(tracks).filter(x => x !== -1).length == 2
}