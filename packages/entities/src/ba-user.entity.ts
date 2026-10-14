import {
  Column,
  CreateDateColumn,
  Entity,
  PrimaryColumn,
  UpdateDateColumn,
} from "typeorm";

/**
 * Better Auth user. Property names match Better Auth's default `user` field
 * names so the adapter can pass them straight through; columns are snake_case.
 */
@Entity({ schema: "auth", name: "user" })
export class BaUser {
  @PrimaryColumn({ type: "text" })
  id: string;

  @Column({ type: "text" })
  name: string;

  @Column({ type: "text", unique: true })
  email: string;

  @Column({ name: "email_verified", type: "boolean", default: false })
  emailVerified: boolean;

  @Column({ type: "text", nullable: true })
  image: string | null;

  @CreateDateColumn({ name: "created_at", type: "timestamptz" })
  createdAt: Date;

  @UpdateDateColumn({ name: "updated_at", type: "timestamptz" })
  updatedAt: Date;
}
