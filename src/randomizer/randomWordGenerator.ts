"use strict";
/**
 * Created by Marcel Würsch on 07.11.16.
 */


import * as fs from "fs";
import * as _ from "lodash";
import * as path from "path";

export class RandomWordGenerator {

    static rootDir = path.resolve(__dirname, "../../", "words");
    /**
     * a list of ajdectives
     * 
     * @static
     * @memberof RandomWordGenerator
     */
    static adjectives = fs.readFileSync(RandomWordGenerator.rootDir + "/adjectives", "utf8").toString().split("\n").map(Function.prototype.call, String.prototype.trim);

    /**
     * a list of animal names
     * 
     * @static
     * @memberof RandomWordGenerator
     */
    static animals = fs.readFileSync(RandomWordGenerator.rootDir + "/animals", "utf8").toString().split("\n").map(Function.prototype.call, String.prototype.trim);

    /**
     * generate a random word
     * 
     * a random word contains 2 adjectives and 1 animal
     * 
     * @static
     * @returns {string} the random name
     * 
     * @memberof RandomWordGenerator
     */
    static generateRandomWord(): string {
        return _.sample(RandomWordGenerator.adjectives) + _.sample(RandomWordGenerator.adjectives) + _.sample(RandomWordGenerator.animals);
    }

}