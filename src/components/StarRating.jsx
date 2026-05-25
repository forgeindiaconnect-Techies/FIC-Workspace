import React, { useState } from 'react';
import { Star } from 'lucide-react';

const StarRating = () => {
  const [rating, setRating] = useState(0);
  const [hover, setHover] = useState(0);

  return (
    <div className="flex items-center gap-2">
      {[1, 2, 3, 4, 5].map((star) => (
        <button
          key={star}
          type="button"
          className="transition-all duration-200 hover:scale-125 active:scale-95"
          onClick={() => setRating(star)}
          onMouseEnter={() => setHover(star)}
          onMouseLeave={() => setHover(0)}
        >
          <Star
            size={32}
            className={`transition-colors duration-200 ${
              (hover || rating) >= star 
                ? 'fill-amber-400 text-amber-400' 
                : 'text-zinc-300 dark:text-zinc-700'
            }`}
            strokeWidth={1.5}
          />
        </button>
      ))}
    </div>
  );
};

export default StarRating;
