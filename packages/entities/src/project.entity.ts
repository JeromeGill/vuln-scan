import {
  Column,
  CreateDateColumn,
  Entity,
  JoinColumn,
  ManyToOne,
  PrimaryGeneratedColumn,
  Unique,
  UpdateDateColumn,
  type Relation,
} from "typeorm";
import { BaOrganization } from "./ba-organization.entity.js";

/**
 * One app the user deploys. Belongs to an organization (for now the user's
 * personal one), whose names are unique ignoring case.
 */
@Entity({ name: "project" })
@Unique("project_organization_name_key_unique", ["organizationId", "nameKey"])
export class Project {
  @PrimaryGeneratedColumn("uuid")
  id: string;

  @Column({ name: "organization_id", type: "text" })
  organizationId: string;

  @ManyToOne(() => BaOrganization, { onDelete: "CASCADE" })
  @JoinColumn({ name: "organization_id" })
  organization?: Relation<BaOrganization>;

  @Column({ type: "text" })
  name: string;

  /**
   * `lower(name)`, computed by Postgres, so the unique constraint ignores
   * case (TypeORM can't synchronize an index on an expression). Read-only.
   */
  @Column({
    name: "name_key",
    type: "text",
    generatedType: "STORED",
    asExpression: "lower(name)",
    insert: false,
    update: false,
  })
  nameKey: string;

  @CreateDateColumn({ name: "created_at", type: "timestamptz" })
  createdAt: Date;

  @UpdateDateColumn({ name: "updated_at", type: "timestamptz" })
  updatedAt: Date;
}
