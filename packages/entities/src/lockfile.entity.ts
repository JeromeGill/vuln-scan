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
import { Release } from "./release.entity.js";

/**
 * A lockfile of a release, at its path in the repository. The file itself
 * is in object storage under `storageKey`; uploading the same path to the
 * release again replaces it. Deleted with its release (the project's
 * deletion removes the stored files).
 */
@Entity({ name: "lockfile" })
@Unique("lockfile_release_path_unique", ["releaseId", "path"])
export class Lockfile {
  @PrimaryGeneratedColumn("uuid")
  id: string;

  @Column({ name: "release_id", type: "uuid" })
  releaseId: string;

  @ManyToOne(() => Release, { onDelete: "CASCADE" })
  @JoinColumn({ name: "release_id" })
  release?: Relation<Release>;

  /** Relative path, e.g. `apps/web/pnpm-lock.yaml`. */
  @Column({ type: "text" })
  path: string;

  @Column({ name: "storage_key", type: "text", unique: true })
  storageKey: string;

  /** Bytes. */
  @Column({ type: "integer" })
  size: number;

  /** Hex SHA-256 of the file. */
  @Column({ type: "text" })
  sha256: string;

  @CreateDateColumn({ name: "created_at", type: "timestamptz" })
  createdAt: Date;

  /** When the file was last uploaded (replacing it updates this). */
  @UpdateDateColumn({ name: "updated_at", type: "timestamptz" })
  updatedAt: Date;
}
