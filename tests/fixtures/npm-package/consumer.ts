/**
 * Test fixture: consumer file that imports from an npm package.
 */
import { UserProfile, Address, ZipCode } from 'fake-types-pkg';

export interface Customer {
  id: number;
  profile: UserProfile;
  billingAddress: Address;
  postalCode: ZipCode;
}

export interface SimpleWrapper {
  data: Address;
}
