// Declarations imported by the const-params type-aware tests. Lists can't be recognised by their
// keys, so only type information can tell that these are widened where they are declared.
declare function loadRoles(): string[]

export const ROLES = ['admin', 'member']
export const CONST_ROLES = ['admin', 'member'] as const
export const TYPED_ROLES: string[] = ['admin', 'member']
export const LOADED_ROLES = loadRoles()
export let LET_ROLES = ['admin', 'member']
export const config = { roles: ['admin', 'member'] }
