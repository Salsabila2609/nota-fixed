import pLimit from 'p-limit'


export const cpuLimit = pLimit(6)

export const ioLimit = pLimit(20)