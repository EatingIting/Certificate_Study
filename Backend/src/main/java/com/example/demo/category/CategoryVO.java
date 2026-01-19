package com.example.demo.category;

import lombok.Data;

@Data
public class CategoryVO {

    private Long id;
    private String name;
    private Long parentId;
    private int level;

}