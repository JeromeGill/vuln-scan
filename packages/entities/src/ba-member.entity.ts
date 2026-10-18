import {
  Column,
  CreateDateColumn,
  Entity,
  Index,
  JoinColumn,
  ManyToOne,
  PrimaryColumn,
  type Relation,
} from "typeorm";
import { BaOrganization } from "./ba-organization.entity.js";
import { BaUser } from "./ba-user.entity.js";

/**
 * Better Auth organization member (organization plugin's `member` model):
 * a user's membership of an organization and their role in it (`owner`,
 * `admin`, `member`).
 */
@Entity({ schema: "auth", name: "member" })
export class BaMember {
  @PrimaryColumn({ type: "text" })
  id: string;

  @Index()
  @Column({ name: "organization_id", type: "text" })
  organizationId: string;

  @ManyToOne(() => BaOrganization, { onDelete: "CASCADE" })
  @JoinColumn({ name: "organization_id" })
  organization?: Relation<BaOrganization>;

  @Index()
  @Column({ name: "user_id", type: "text" })
  userId: string;

  @ManyToOne(() => BaUser, { onDelete: "CASCADE" })
  @JoinColumn({ name: "user_id" })
  user?: Relation<BaUser>;

  @Column({ type: "text", default: "member" })
  role: string;

  @CreateDateColumn({ name: "created_at", type: "timestamptz" })
  createdAt: Date;
}
