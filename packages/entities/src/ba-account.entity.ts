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

/**
 * Better Auth account (`account` model): one row per sign-in method linked to
 * a user. Email/password sign-up stores the password hash here with
 * `providerId` "credential".
 */
@Entity({ schema: "auth", name: "account" })
export class BaAccount {
  @PrimaryColumn({ type: "text" })
  id: string;

  @Column({ name: "account_id", type: "text" })
  accountId: string;

  @Column({ name: "provider_id", type: "text" })
  providerId: string;

  @Index()
  @Column({ name: "user_id", type: "text" })
  userId: string;

  @ManyToOne(() => BaUser, { onDelete: "CASCADE" })
  @JoinColumn({ name: "user_id" })
  user?: Relation<BaUser>;

  @Column({ name: "access_token", type: "text", nullable: true })
  accessToken: string | null;

  @Column({ name: "refresh_token", type: "text", nullable: true })
  refreshToken: string | null;

  @Column({ name: "id_token", type: "text", nullable: true })
  idToken: string | null;

  @Column({
    name: "access_token_expires_at",
    type: "timestamptz",
    nullable: true,
  })
  accessTokenExpiresAt: Date | null;

  @Column({
    name: "refresh_token_expires_at",
    type: "timestamptz",
    nullable: true,
  })
  refreshTokenExpiresAt: Date | null;

  @Column({ type: "text", nullable: true })
  scope: string | null;

  @Column({ type: "text", nullable: true })
  password: string | null;

  @CreateDateColumn({ name: "created_at", type: "timestamptz" })
  createdAt: Date;

  @UpdateDateColumn({ name: "updated_at", type: "timestamptz" })
  updatedAt: Date;
}
