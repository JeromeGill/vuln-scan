import {
  Column,
  CreateDateColumn,
  Entity,
  Index,
  JoinColumn,
  ManyToOne,
  PrimaryGeneratedColumn,
  type Relation,
} from "typeorm";
import { BaUser } from "./ba-user.entity.js";
import { Project } from "./project.entity.js";

/**
 * A credential CI uploads a project's lockfiles with. Belongs to the
 * project (deleted with it), not to the user who created it. Only the
 * secret's SHA-256 hash and its last four characters are stored.
 */
@Entity({ name: "upload_token" })
export class UploadToken {
  @PrimaryGeneratedColumn("uuid")
  id: string;

  @Index()
  @Column({ name: "project_id", type: "uuid" })
  projectId: string;

  @ManyToOne(() => Project, { onDelete: "CASCADE" })
  @JoinColumn({ name: "project_id" })
  project?: Relation<Project>;

  @Column({ type: "text" })
  name: string;

  /** Hex SHA-256 of the full token, which is how an upload finds it. */
  @Column({ name: "token_hash", type: "text", unique: true })
  tokenHash: string;

  /** The token's last four characters, to tell tokens apart in the UI. */
  @Column({ name: "last_four", type: "text" })
  lastFour: string;

  /** Who created it; `null` once that user is deleted (the token stays). */
  @Column({ name: "created_by_id", type: "text", nullable: true })
  createdById: string | null;

  @ManyToOne(() => BaUser, { onDelete: "SET NULL", nullable: true })
  @JoinColumn({ name: "created_by_id" })
  createdBy?: Relation<BaUser> | null;

  @CreateDateColumn({ name: "created_at", type: "timestamptz" })
  createdAt: Date;

  /** `null` for a token that never expires. */
  @Column({ name: "expires_at", type: "timestamptz", nullable: true })
  expiresAt: Date | null;

  @Column({ name: "last_used_at", type: "timestamptz", nullable: true })
  lastUsedAt: Date | null;

  /** Set when revoked: the row is kept, but it's no longer listed or valid. */
  @Column({ name: "revoked_at", type: "timestamptz", nullable: true })
  revokedAt: Date | null;
}
