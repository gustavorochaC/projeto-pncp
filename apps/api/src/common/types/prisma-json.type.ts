export type PrismaJson =
  | string
  | number
  | boolean
  | null
  | PrismaJson[]
  | { [key: string]: PrismaJson };
