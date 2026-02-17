"use client";

import { useState, useEffect, useRef } from "react";
import { X, Plus, Loader2 } from "lucide-react";

interface Tag {
  id: string;
  name: string;
  color?: string | null;
}

interface TagInputProps {
  selectedTags: Tag[];
  onChange: (tags: Tag[]) => void;
  placeholder?: string;
}

export function TagInput({ selectedTags, onChange, placeholder = "Add tag..." }: TagInputProps) {
  const [allTags, setAllTags] = useState<Tag[]>([]);
  const [loading, setLoading] = useState(true);
  const [inputValue, setInputValue] = useState("");
  const [showDropdown, setShowDropdown] = useState(false);
  const [creating, setCreating] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);
  const dropdownRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    async function fetchTags() {
      try {
        const response = await fetch("/api/tags");
        if (response.ok) {
          const data = await response.json();
          setAllTags(data.tags || []);
        }
      } catch (err) {
        console.error("Failed to fetch tags:", err);
      } finally {
        setLoading(false);
      }
    }
    fetchTags();
  }, []);

  useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      if (
        dropdownRef.current &&
        !dropdownRef.current.contains(event.target as Node) &&
        inputRef.current &&
        !inputRef.current.contains(event.target as Node)
      ) {
        setShowDropdown(false);
      }
    }
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  const selectedIds = new Set(selectedTags.map((t) => t.id));

  const filteredTags = allTags.filter(
    (tag) =>
      !selectedIds.has(tag.id) &&
      tag.name.toLowerCase().includes(inputValue.toLowerCase())
  );

  const exactMatch = allTags.some(
    (tag) => tag.name.toLowerCase() === inputValue.toLowerCase()
  );

  const handleSelectTag = (tag: Tag) => {
    onChange([...selectedTags, tag]);
    setInputValue("");
    setShowDropdown(false);
  };

  const handleRemoveTag = (tagId: string) => {
    onChange(selectedTags.filter((t) => t.id !== tagId));
  };

  const handleCreateTag = async () => {
    if (!inputValue.trim() || creating) return;
    setCreating(true);
    try {
      const response = await fetch("/api/tags", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name: inputValue.trim() }),
      });
      if (response.ok) {
        const newTag = await response.json();
        setAllTags((prev) => [...prev, newTag]);
        onChange([...selectedTags, newTag]);
        setInputValue("");
        setShowDropdown(false);
      }
    } catch (err) {
      console.error("Failed to create tag:", err);
    } finally {
      setCreating(false);
    }
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === "Enter") {
      e.preventDefault();
      if (filteredTags.length > 0) {
        handleSelectTag(filteredTags[0]);
      } else if (inputValue.trim() && !exactMatch) {
        handleCreateTag();
      }
    }
    if (e.key === "Backspace" && !inputValue && selectedTags.length > 0) {
      handleRemoveTag(selectedTags[selectedTags.length - 1].id);
    }
  };

  const TAG_COLORS = [
    "bg-blue-100 text-blue-700",
    "bg-emerald-100 text-emerald-700",
    "bg-purple-100 text-purple-700",
    "bg-amber-100 text-amber-700",
    "bg-pink-100 text-pink-700",
    "bg-cyan-100 text-cyan-700",
    "bg-orange-100 text-orange-700",
    "bg-indigo-100 text-indigo-700",
  ];

  const getTagColor = (tag: Tag) => {
    if (tag.color) {
      return { backgroundColor: tag.color + "20", color: tag.color };
    }
    // Deterministic color based on tag name
    const index = tag.name.split("").reduce((acc, c) => acc + c.charCodeAt(0), 0) % TAG_COLORS.length;
    return TAG_COLORS[index];
  };

  return (
    <div className="relative">
      <div className="flex flex-wrap items-center gap-1.5 p-2 bg-white border border-slate-200 rounded-xl focus-within:ring-2 focus-within:ring-[#03A9F4] focus-within:border-[#03A9F4] min-h-[42px]">
        {selectedTags.map((tag) => {
          const colorStyle = getTagColor(tag);
          return (
            <span
              key={tag.id}
              className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-md text-xs font-medium ${
                typeof colorStyle === "string" ? colorStyle : ""
              }`}
              style={typeof colorStyle === "object" ? colorStyle : undefined}
            >
              {tag.name}
              <button
                type="button"
                onClick={() => handleRemoveTag(tag.id)}
                className="hover:opacity-70"
              >
                <X className="w-3 h-3" />
              </button>
            </span>
          );
        })}
        <input
          ref={inputRef}
          type="text"
          value={inputValue}
          onChange={(e) => {
            setInputValue(e.target.value);
            setShowDropdown(true);
          }}
          onFocus={() => setShowDropdown(true)}
          onKeyDown={handleKeyDown}
          placeholder={selectedTags.length === 0 ? placeholder : ""}
          className="flex-1 min-w-[80px] text-sm outline-none bg-transparent placeholder:text-slate-400"
        />
        {loading && <Loader2 className="w-4 h-4 animate-spin text-slate-400" />}
      </div>

      {showDropdown && !loading && (inputValue || filteredTags.length > 0) && (
        <div
          ref={dropdownRef}
          className="absolute z-10 w-full mt-1 bg-white border border-slate-200 rounded-xl shadow-lg max-h-48 overflow-y-auto"
        >
          {filteredTags.map((tag) => (
            <button
              key={tag.id}
              type="button"
              onClick={() => handleSelectTag(tag)}
              className="w-full px-3 py-2 text-left text-sm hover:bg-slate-50 transition-colors flex items-center gap-2"
            >
              <span
                className="w-2.5 h-2.5 rounded-full flex-shrink-0"
                style={{ backgroundColor: tag.color || "#94a3b8" }}
              />
              {tag.name}
            </button>
          ))}
          {inputValue.trim() && !exactMatch && (
            <button
              type="button"
              onClick={handleCreateTag}
              disabled={creating}
              className="w-full px-3 py-2 text-left text-sm hover:bg-slate-50 transition-colors flex items-center gap-2 text-[#03A9F4] border-t border-slate-100"
            >
              {creating ? (
                <Loader2 className="w-3.5 h-3.5 animate-spin" />
              ) : (
                <Plus className="w-3.5 h-3.5" />
              )}
              Create &quot;{inputValue.trim()}&quot;
            </button>
          )}
        </div>
      )}
    </div>
  );
}
