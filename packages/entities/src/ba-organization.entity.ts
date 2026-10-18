import { Column, CreateDateColumn, Entity, PrimaryColumn } from "typeorm";

/**
 * Better Auth organization (organization plugin's `organization` model).
 * Every user gets a personal one at sign-up; teams later are organizations
 * with more members.
 */
@Entity({ schema: "auth", name: "organization" })
export class BaOrganization {
  @PrimaryColumn({ type: "text" })
  id: string;

  @Column({ type: "text" })
  name: string;

  @Column({ type: "text", unique: true })
  slug: string;

  @Column({ type: "text", nullable: true })
  logo: string | null;

  /** JSON, stored as a string by Better Auth. */
  @Column({ type: "text", nullable: true })
  metadata: string | null;

  @CreateDateColumn({ name: "created_at", type: "timestamptz" })
  createdAt: Date;
}
