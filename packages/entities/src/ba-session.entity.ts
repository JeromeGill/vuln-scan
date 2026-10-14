import {
  Column,
  CreateDateColumn,
  Entity,
  Index,
  JoinColumn,
  ManyToOne,
  PrimaryColumn,
  UpdateDateColumn,
  type Relation,
} from "typeorm";
import { BaUser } from "./ba-user.entity.js";

/** Better Auth session (`session` model). */
@Entity({ schema: "auth", name: "session" })
export class BaSession {
  @PrimaryColumn({ type: "text" })
  id: string;

  @Column({ name: "expires_at", type: "timestamptz" })
  expiresAt: Date;

  @Column({ type: "text", unique: true })
  token: string;

  @Column({ name: "ip_address", type: "text", nullable: true })
  ipAddress: string | null;

  @Column({ name: "user_agent", type: "text", nullable: true })
  userAgent: string | null;

  @Index()
  @Column({ name: "user_id", type: "text" })
  userId: string;

  @ManyToOne(() => BaUser, { onDelete: "CASCADE" })
  @JoinColumn({ name: "user_id" })
  user?: Relation<BaUser>;

  @CreateDateColumn({ name: "created_at", type: "timestamptz" })
  createdAt: Date;

  @UpdateDateColumn({ name: "updated_at", type: "timestamptz" })
  updatedAt: Date;
}
