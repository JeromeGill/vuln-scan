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
 * Better Auth invitation to an organization (organization plugin's
 * `invitation` model). Unused until teams: personal organizations have one
 * member.
 */
@Entity({ schema: "auth", name: "invitation" })
export class BaInvitation {
  @PrimaryColumn({ type: "text" })
  id: string;

  @Index()
  @Column({ name: "organization_id", type: "text" })
  organizationId: string;

  @ManyToOne(() => BaOrganization, { onDelete: "CASCADE" })
  @JoinColumn({ name: "organization_id" })
  organization?: Relation<BaOrganization>;

  @Index()
  @Column({ type: "text" })
  email: string;

  @Column({ type: "text", nullable: true })
  role: string | null;

  /** `pending`, `accepted`, `rejected`, or `canceled`. */
  @Column({ type: "text", default: "pending" })
  status: string;

  @Column({ name: "expires_at", type: "timestamptz" })
  expiresAt: Date;

  @CreateDateColumn({ name: "created_at", type: "timestamptz" })
  createdAt: Date;

  @Column({ name: "inviter_id", type: "text" })
  inviterId: string;

  @ManyToOne(() => BaUser, { onDelete: "CASCADE" })
  @JoinColumn({ name: "inviter_id" })
  inviter?: Relation<BaUser>;
}
