"use client";

import * as React from "react";
import { UploadCloud, X, CheckCircle2, Trash2 } from "lucide-react";
import { motion, AnimatePresence } from "framer-motion";

import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { Progress } from "@/components/ui/progress";

// Define the structure for a file being uploaded
export interface UploadedFile {
  id: string;
  file: File;
  progress: number; // 0-100
  status: "uploading" | "completed" | "error";
}

// Define the props for the component
export interface FileUploadCardProps
  extends Omit<
    React.HTMLAttributes<HTMLDivElement>,
    'onAnimationStart' | 'onDrag' | 'onDragStart' | 'onDragEnd'
  > {
  files: UploadedFile[];
  onFilesChange: (files: File[]) => void;
  onFileRemove: (id: string) => void;
  onClose?: () => void;
}

export const FileUploadCard = React.forwardRef<HTMLDivElement, FileUploadCardProps>(
  ({ className, files = [], onFilesChange, onFileRemove, onClose, ...props }, ref) => {
    const [isDragging, setIsDragging] = React.useState(false);
    const fileInputRef = React.useRef<HTMLInputElement>(null);

    // Handler for drag enter event
    const handleDragEnter = (e: React.DragEvent<HTMLDivElement>) => {
      e.preventDefault();
      e.stopPropagation();
      setIsDragging(true);
    };

    // Handler for drag leave event
    const handleDragLeave = (e: React.DragEvent<HTMLDivElement>) => {
      e.preventDefault();
      e.stopPropagation();
      setIsDragging(false);
    };

    // Handler for drag over event
    const handleDragOver = (e: React.DragEvent<HTMLDivElement>) => {
      e.preventDefault();
      e.stopPropagation();
    };

    // Handler for drop event
    const handleDrop = (e: React.DragEvent<HTMLDivElement>) => {
      e.preventDefault();
      e.stopPropagation();
      setIsDragging(false);
      const droppedFiles = Array.from(e.dataTransfer.files);
      if (droppedFiles && droppedFiles.length > 0) {
        onFilesChange(droppedFiles);
      }
    };

    // Handler for file input change
    const handleFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
      const selectedFiles = Array.from(e.target.files || []);
      if (selectedFiles.length > 0) {
        onFilesChange(selectedFiles);
      }
    };

    // Trigger file input click
    const triggerFileSelect = () => fileInputRef.current?.click();

    // Format file size for display
    const formatFileSize = (bytes: number) => {
      if (bytes === 0) return "0 KB";
      const k = 1024;
      const sizes = ["Bytes", "KB", "MB", "GB", "TB"];
      const i = Math.floor(Math.log(bytes) / Math.log(k));
      return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + " " + sizes[i];
    };

    // Animation variants for Framer Motion
    const cardVariants = {
      hidden: { opacity: 0, y: 20 },
      visible: { opacity: 1, y: 0 },
    };

    const fileItemVariants = {
      hidden: { opacity: 0, x: -20 },
      visible: { opacity: 1, x: 0 },
    };

    return (
      <motion.div
        ref={ref}
        variants={cardVariants}
        initial="hidden"
        animate="visible"
        transition={{ duration: 0.3 }}
        className={cn(
          "w-full max-w-lg bg-card rounded-2xl border border-border shadow-md select-none",
          className
        )}
        {...props}
      >
        <div className="p-6">
          <div className="flex items-start justify-between">
            <div className="flex items-center gap-4">
              <div className="w-12 h-12 flex items-center justify-center rounded-2xl bg-muted/80 border border-border/60">
                <UploadCloud className="w-6 h-6 text-muted-foreground" />
              </div>
              <div>
                <h3 className="text-lg font-semibold text-foreground">Upload files</h3>
                <p className="text-sm text-muted-foreground mt-0.5">
                  Select and upload the files of your choice
                </p>
              </div>
            </div>
            {onClose && (
              <Button
                variant="ghost"
                size="icon"
                className="rounded-full w-8 h-8 cursor-pointer"
                onClick={onClose}
              >
                <X className="w-4 h-4" />
              </Button>
            )}
          </div>

          <div
            onDragEnter={handleDragEnter}
            onDragLeave={handleDragLeave}
            onDragOver={handleDragOver}
            onDrop={handleDrop}
            onClick={triggerFileSelect}
            className={cn(
              "mt-6 border-2 border-dashed rounded-xl p-8 flex flex-col items-center justify-center text-center transition-all duration-200 cursor-pointer",
              isDragging
                ? "border-primary bg-primary/10 scale-[1.01]"
                : "border-border/80 hover:border-primary/50 hover:bg-muted/30"
            )}
          >
            <input
              ref={fileInputRef}
              type="file"
              multiple
              className="hidden"
              onChange={handleFileSelect}
            />
            <UploadCloud className="w-10 h-10 text-muted-foreground mb-4" />
            <p className="font-semibold text-foreground">Choose a file or drag & drop it here.</p>
            <p className="text-xs text-muted-foreground mt-1">
              JPEG, PNG, PDF, and MP4 formats, up to 50 MB.
            </p>
            <Button variant="outline" size="sm" className="mt-4 pointer-events-none rounded-xl">
              Browse File
            </Button>
          </div>
        </div>

        {files.length > 0 && (
          <div className="p-6 border-t border-border">
            <ul className="space-y-4">
              <AnimatePresence>
                {files.map((file) => (
                  <motion.li
                    key={file.id}
                    variants={fileItemVariants}
                    initial="hidden"
                    animate="visible"
                    exit="hidden"
                    layout
                    className="flex items-center justify-between gap-3"
                  >
                    <div className="flex items-center gap-3 min-w-0 flex-1">
                      <div className="w-10 h-10 flex items-center justify-center rounded-xl bg-muted text-xs font-bold font-mono text-muted-foreground shrink-0 border border-border/60">
                        {file.file.type.split("/")[1]?.toUpperCase().substring(0, 3) || "FILE"}
                      </div>
                      <div className="flex-1 min-w-0">
                        <p className="text-sm font-medium text-foreground truncate max-w-[160px] sm:max-w-xs">
                          {file.file.name}
                        </p>
                        <div className="text-xs text-muted-foreground tabular-nums flex items-center gap-1.5 mt-0.5">
                          {file.status === "uploading" && (
                            <span>
                              {formatFileSize((file.file.size * file.progress) / 100)} of{" "}
                              {formatFileSize(file.file.size)}
                            </span>
                          )}
                          {file.status === "completed" && (
                            <span>{formatFileSize(file.file.size)}</span>
                          )}
                          <span>•</span>
                          <span
                            className={cn(
                              file.status === "uploading" && "text-primary font-medium",
                              file.status === "completed" && "text-emerald-500 font-medium"
                            )}
                          >
                            {file.status === "uploading" ? `Uploading...` : "Completed"}
                          </span>
                        </div>
                        {file.status === "uploading" && (
                          <Progress value={file.progress} className="h-1.5 mt-2" />
                        )}
                      </div>
                    </div>

                    <div className="flex items-center gap-1.5 shrink-0">
                      {file.status === "completed" && (
                        <CheckCircle2 className="w-4.5 h-4.5 text-emerald-500" />
                      )}
                      <Button
                        variant="ghost"
                        size="icon"
                        className="rounded-full w-8 h-8 text-muted-foreground hover:text-foreground cursor-pointer"
                        onClick={() => onFileRemove(file.id)}
                      >
                        {file.status === "completed" ? (
                          <Trash2 className="w-4 h-4 text-rose-500" />
                        ) : (
                          <X className="w-4 h-4" />
                        )}
                      </Button>
                    </div>
                  </motion.li>
                ))}
              </AnimatePresence>
            </ul>
          </div>
        )}
      </motion.div>
    );
  }
);
FileUploadCard.displayName = "FileUploadCard";

// A mock file object for demonstration
export const createMockFile = (name: string, size: number, type: string): File => {
  const blob = new Blob([""], { type });
  return new File([blob], name, { type });
};

// Initial files for the demo
export const initialDemoFiles: UploadedFile[] = [
  {
    id: "cv-pdf",
    file: createMockFile("my-cv.pdf", 120 * 1024, "application/pdf"),
    progress: 0,
    status: "uploading",
  },
  {
    id: "cert-pdf",
    file: createMockFile("google-certificate.pdf", 94 * 1024, "application/pdf"),
    progress: 100,
    status: "completed",
  },
];

export function FileUploadDemo({ className }: { className?: string }) {
  const [files, setFiles] = React.useState<UploadedFile[]>(initialDemoFiles);
  const [isVisible, setIsVisible] = React.useState(true);

  // Simulate upload progress for the "uploading" file
  React.useEffect(() => {
    const uploadingFile = files.find((f) => f.status === "uploading");
    if (!uploadingFile) return;

    const interval = setInterval(() => {
      setFiles((prevFiles) =>
        prevFiles.map((f) => {
          if (f.id === uploadingFile.id) {
            const newProgress = Math.min(f.progress + 10, 100);
            return {
              ...f,
              progress: newProgress,
              status: newProgress === 100 ? "completed" : "uploading",
            };
          }
          return f;
        })
      );
    }, 300); // Update progress every 300ms

    return () => clearInterval(interval);
  }, [files]);

  // Handler for adding new files
  const handleFilesChange = (newFiles: File[]) => {
    const newUploadedFiles: UploadedFile[] = newFiles.map((file) => ({
      id: `${file.name}-${Date.now()}`,
      file,
      progress: 0,
      status: "uploading",
    }));
    setFiles((prev) => [...prev, ...newUploadedFiles]);
  };

  // Handler for removing a file
  const handleFileRemove = (id: string) => {
    setFiles((prevFiles) => prevFiles.filter((file) => file.id !== id));
  };

  // Handler for closing the card
  const handleClose = () => {
    setIsVisible(false);
    // After animation, reset to show again for demo purposes
    setTimeout(() => {
      setIsVisible(true);
      setFiles(initialDemoFiles);
    }, 500);
  };

  return (
    <div className={cn("w-full flex items-center justify-center p-4", className)}>
      {isVisible && (
        <FileUploadCard
          files={files}
          onFilesChange={handleFilesChange}
          onFileRemove={handleFileRemove}
          onClose={handleClose}
        />
      )}
    </div>
  );
}

export default FileUploadDemo;
